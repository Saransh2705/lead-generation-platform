import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// Quick-pick suggestions for the "every N minutes" input (any value ≥1 is allowed).
const SUGGESTIONS = [1, 5, 15, 30, 60, 180, 360, 720, 1440, 10080];
function intervalLabel(m: number) {
  if (m < 60) return `Every ${m} min`;
  if (m === 1440) return 'Daily';
  if (m === 10080) return 'Weekly';
  if (m % 1440 === 0) return `Every ${m / 1440} days`;
  if (m % 60 === 0) return `Every ${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `Every ${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function whenNext(iso: string | null) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const m = Math.round(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h}h ${m % 60}m` : `in ${Math.floor(h / 24)}d`;
}

async function createSchedule(formData: FormData) {
  'use server';
  const category_key = String(formData.get('category_key') || '');
  const interval_minutes = Math.max(1, parseInt(String(formData.get('interval_minutes') || '60')) || 60);
  const lead_count = Math.max(1, Math.min(50, parseInt(String(formData.get('lead_count') || '12')) || 12));
  if (!category_key) return;
  await supabaseAdmin.from('schedules').insert({
    category_key, interval_minutes, lead_count, enabled: true, next_run_at: new Date().toISOString(),
  });
  revalidatePath('/schedules'); revalidatePath('/');
}
async function toggleSchedule(formData: FormData) {
  'use server';
  const id = formData.get('id');
  const enabled = String(formData.get('enabled')) === 'true';
  await supabaseAdmin.from('schedules').update({ enabled: !enabled }).eq('id', id);
  revalidatePath('/schedules'); revalidatePath('/');
}
async function deleteSchedule(formData: FormData) {
  'use server';
  await supabaseAdmin.from('schedules').delete().eq('id', formData.get('id'));
  revalidatePath('/schedules'); revalidatePath('/');
}

export default async function SchedulesPage() {
  const { data: categories } = await supabaseAdmin.from('categories').select('*').order('is_builtin', { ascending: false }).order('id');
  const cats = categories || [];
  const catByKey: Record<string, any> = {};
  for (const c of cats) catByKey[c.key] = c;
  const { data: schedules } = await supabaseAdmin.from('schedules').select('*').order('created_at', { ascending: false });
  const list = schedules || [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Schedules</h1>
          <div className="sub">Run a category automatically on a repeating interval</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">New Schedule</div>
          <div className="card-sub">Pick a category and how often it should run. Executed by Supabase (pg_cron) every minute — so schedules can run as often as <strong>every 1 minute</strong>, fully unattended.</div>
          <form action={createSchedule}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <label className="field-label">Category</label>
                <select name="category_key" required style={{ width: '100%' }} defaultValue="">
                  <option value="" disabled>Choose a category…</option>
                  {cats.map((c: any) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Run every … minutes</label>
                <input name="interval_minutes" type="number" min="1" step="1" defaultValue="60" required list="interval-suggestions" style={{ width: '100%' }} />
                <datalist id="interval-suggestions">
                  {SUGGESTIONS.map((m) => <option key={m} value={m}>{intervalLabel(m)}</option>)}
                </datalist>
                <div style={{ fontSize: 11.5, color: 'var(--muted-soft)', marginTop: 4 }}>Any value ≥ 1. e.g. 1, 5, 15, 30, 60, 360, 1440 (daily)</div>
              </div>
              <div>
                <label className="field-label">Leads per run</label>
                <input name="lead_count" type="number" min="1" max="50" defaultValue="12" style={{ width: '100%' }} />
              </div>
            </div>
            <button type="submit">＋ Create Schedule</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Active Schedules</div>
          {list.length === 0 ? (
            <div className="empty">No schedules yet. Create one above to run a category automatically.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Category</th><th>Interval</th><th>Leads</th><th>Last run</th><th>Next run</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {list.map((s: any) => {
                    const c = catByKey[s.category_key];
                    return (
                      <tr key={s.id}>
                        <td className="cell-strong">{c ? `${c.icon} ${c.label}` : s.category_key}</td>
                        <td className="cell-muted">{intervalLabel(s.interval_minutes)}</td>
                        <td className="cell-muted">{s.lead_count}</td>
                        <td className="cell-muted">{fmt(s.last_run_at)}</td>
                        <td className="cell-muted">{s.enabled ? whenNext(s.next_run_at) : '—'}</td>
                        <td><span className={`badge ${s.enabled ? 'badge-green' : 'badge-gray'}`}>{s.enabled ? 'Active' : 'Paused'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <form action={toggleSchedule}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="enabled" value={String(s.enabled)} />
                              <button type="submit" className="btn-ghost btn-sm">{s.enabled ? 'Pause' : 'Resume'}</button>
                            </form>
                            <form action={deleteSchedule}>
                              <input type="hidden" name="id" value={s.id} />
                              <button type="submit" className="btn-danger btn-sm">Delete</button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
