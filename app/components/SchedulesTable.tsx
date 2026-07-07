'use client';

import { useState } from 'react';
import FormCombobox from './FormCombobox';

type Sched = { id: string | number; category_key: string; interval_minutes: number; lead_count: number; enabled: boolean; last_run_at: string | null; next_run_at: string | null };
type Cat = { key: string; label: string; icon?: string; geo?: string };

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

export default function SchedulesTable({ list, cats, toggleAction, deleteAction, updateAction }: {
  list: Sched[];
  cats: Cat[];
  toggleAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
  updateAction: (fd: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const catByKey: Record<string, Cat> = {};
  for (const c of cats) catByKey[c.key] = c;

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Category</th><th>Location</th><th>Interval</th><th>Leads</th><th>Last run</th><th>Next run</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {list.map((s) => {
            const c = catByKey[s.category_key];
            const id = String(s.id);
            if (editing === id) {
              return (
                <tr key={id}>
                  <td colSpan={8}>
                    <form action={updateAction} onSubmit={() => setEditing(null)}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: '6px 2px' }}>
                      <input type="hidden" name="id" value={id} />
                      <div style={{ minWidth: 220 }}>
                        <label className="field-label">Category</label>
                        <FormCombobox name="category_key" defaultValue={s.category_key} placeholder="Choose a category…"
                          options={cats.map((cc) => ({ value: cc.key, label: `${cc.icon || ''} ${cc.label} — ${cc.geo || ''}` }))} />
                      </div>
                      <div style={{ width: 150 }}>
                        <label className="field-label">Every … minutes</label>
                        <input name="interval_minutes" type="number" min="5" step="5" defaultValue={s.interval_minutes} required style={{ width: '100%' }} />
                      </div>
                      <div style={{ width: 110 }}>
                        <label className="field-label">Leads / run</label>
                        <input name="lead_count" type="number" min="1" max="50" defaultValue={s.lead_count} style={{ width: '100%' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="btn-sm">Save</button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={id}>
                <td className="cell-strong">{c ? `${c.icon || ''} ${c.label}` : s.category_key}</td>
                <td className="cell-muted">{c?.geo || '—'}</td>
                <td className="cell-muted">{intervalLabel(s.interval_minutes)}</td>
                <td className="cell-muted">{s.lead_count}</td>
                <td className="cell-muted">{fmt(s.last_run_at)}</td>
                <td className="cell-muted">{s.enabled ? whenNext(s.next_run_at) : '—'}</td>
                <td><span className={`badge ${s.enabled ? 'badge-green' : 'badge-gray'}`}>{s.enabled ? 'Active' : 'Paused'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(id)}>Edit</button>
                    <form action={toggleAction}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="enabled" value={String(s.enabled)} />
                      <button type="submit" className="btn-ghost btn-sm">{s.enabled ? 'Pause' : 'Resume'}</button>
                    </form>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={id} />
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
  );
}
