import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import FormCombobox from '@/app/components/FormCombobox';
import SchedulesTable from '@/app/components/SchedulesTable';

export const dynamic = 'force-dynamic';

const SUGGESTIONS = [30, 60, 180, 360, 720, 1440, 10080];
function intervalLabel(m: number) {
  if (m < 60) return `Every ${m} min`;
  if (m === 1440) return 'Daily';
  if (m === 10080) return 'Weekly';
  if (m % 1440 === 0) return `Every ${m / 1440} days`;
  if (m % 60 === 0) return `Every ${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `Every ${Math.floor(m / 60)}h ${m % 60}m`;
}
async function createSchedule(formData: FormData) {
  'use server';
  const category_key = String(formData.get('category_key') || '');
  const interval_minutes = Math.max(5, parseInt(String(formData.get('interval_minutes') || '360')) || 360);
  const rawCount = String(formData.get('lead_count') || '').trim();
  const lead_count = rawCount ? Math.max(1, Math.min(50, parseInt(rawCount) || 12)) : 12;
  if (!category_key) return;
  await supabaseAdmin.from('schedules').insert({
    category_key, interval_minutes, lead_count, enabled: true, mode: 'scraped', one_off: false,
    next_run_at: new Date().toISOString(),
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
async function updateSchedule(formData: FormData) {
  'use server';
  const id = formData.get('id'); if (!id) return;
  const interval_minutes = Math.max(5, parseInt(String(formData.get('interval_minutes') || '360')) || 360);
  const lead_count = Math.max(1, Math.min(50, parseInt(String(formData.get('lead_count') || '12')) || 12));
  const category_key = String(formData.get('category_key') || '').trim();
  const patch: Record<string, any> = { interval_minutes, lead_count };
  if (category_key) patch.category_key = category_key;
  await supabaseAdmin.from('schedules').update(patch).eq('id', id);
  revalidatePath('/schedules'); revalidatePath('/');
}

export default async function SchedulesPage() {
  const { data: categories } = await supabaseAdmin.from('categories').select('*').order('label');
  const cats = categories || [];
  // Only recurring schedules (hide one-off "Run now" rows).
  const { data: schedules } = await supabaseAdmin.from('schedules').select('*').eq('one_off', false).order('created_at', { ascending: false });
  const list = schedules || [];
  const runnable = cats.filter((c: any) => c.lat != null && c.lng != null);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Schedules</h1>
          <div className="sub">Automatically re-scrape a category on a repeating interval</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">New Schedule</div>
          <div className="card-sub">Pick a category (it already has its business type + location) and how often to re-scrape. Runs unattended in the cloud via Supabase → GitHub Actions.</div>
          {runnable.length === 0 ? (
            <div className="empty">No runnable categories yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Create one with a location →</a></div>
          ) : (
            <form action={createSchedule}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="field-label">Category</label>
                  <FormCombobox name="category_key" placeholder="Choose a category…"
                    options={runnable.map((c: any) => ({ value: c.key, label: `${c.icon} ${c.label} — ${c.geo}` }))} />
                </div>
                <div>
                  <label className="field-label">Re-scrape every … minutes</label>
                  <input name="interval_minutes" type="number" min="5" step="5" defaultValue="360" required list="interval-suggestions" style={{ width: '100%' }} />
                  <datalist id="interval-suggestions">
                    {SUGGESTIONS.map((m) => <option key={m} value={m}>{intervalLabel(m)}</option>)}
                  </datalist>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-soft)', marginTop: 4 }}>Min 5 min. e.g. 60, 360 (6h), 1440 (daily)</div>
                </div>
                <div>
                  <label className="field-label">Leads per run</label>
                  <input name="lead_count" type="number" min="1" max="50" placeholder="12" style={{ width: '100%' }} />
                </div>
              </div>
              <button type="submit">＋ Create Schedule</button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Active Schedules</div>
          {list.length === 0 ? (
            <div className="empty">No schedules yet. Create one above to re-scrape a category automatically.</div>
          ) : (
            <SchedulesTable list={list as any} cats={runnable as any}
              toggleAction={toggleSchedule} deleteAction={deleteSchedule} updateAction={updateSchedule} />
          )}
        </div>
      </div>
    </>
  );
}
