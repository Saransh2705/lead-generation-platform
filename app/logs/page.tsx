import { supabaseAdmin } from '@/lib/supabase';
import { CATEGORY_META, LeadCategory } from '@/lib/leadGenerator';

export const dynamic = 'force-dynamic';

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function logClock(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export default async function LogsPage() {
  let runs: any[] = [];
  try {
    runs = (await supabaseAdmin.from('generation_runs').select('*').order('created_at', { ascending: false }).limit(50)).data || [];
  } catch {}

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Run Logs</h1>
          <div className="sub">Full history of every lead-generation job</div>
        </div>
        <a href="/generate" className="btn btn-sm">+ New Run</a>
      </div>
      <div className="content">
        {runs.length === 0 ? (
          <div className="card"><div className="empty">No runs recorded yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Start one →</a></div></div>
        ) : (
          runs.map((r, i) => {
            const lines: any[] = Array.isArray(r.log) ? r.log : [];
            const statusBadge = r.status === 'completed' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-amber';
            return (
              <details key={r.id} className="run-item" open={i === 0}>
                <summary className="run-head">
                  <span style={{ fontSize: 18 }}>{CATEGORY_META[r.category as LeadCategory]?.icon || '⚡'}</span>
                  <span className="run-cat">{label(r.category)}</span>
                  <span className={`badge ${statusBadge}`}>{label(r.status)}</span>
                  <span className="run-spacer" />
                  <span className="run-meta">{r.leads_generated} leads · {r.duration_ms} ms · {r.source || '—'}</span>
                  <span className="run-meta" style={{ minWidth: 150, textAlign: 'right' }}>{fmtTime(r.created_at)}</span>
                </summary>
                <div className="log-block">
                  {lines.length === 0 ? (
                    <div className="log-line log-warn">no log lines recorded</div>
                  ) : (
                    lines.map((l, idx) => (
                      <div key={idx} className="log-line">
                        <span className="log-ts">{logClock(l.ts)} </span>
                        <span className={`log-${l.level || 'info'}`}>[{(l.level || 'info').toUpperCase()}] </span>
                        <span>{l.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })
        )}
      </div>
    </>
  );
}
