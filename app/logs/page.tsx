import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
const STATUS_BADGE: Record<string, string> = {
  completed: 'badge-green', running: 'badge-amber', dispatched: 'badge-amber', queued: 'badge-gray',
  failed: 'badge-red', blocked: 'badge-red', stuck: 'badge-red', skipped_home_offline: 'badge-gray',
};

export default async function LogsPage() {
  let jobs: any[] = [];
  try { jobs = (await supabaseAdmin.from('scrape_jobs').select('*').order('id', { ascending: false }).limit(50)).data || []; } catch {}

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Run Logs</h1>
          <div className="sub">Every cloud scrape job — dispatched by Supabase, run on GitHub Actions</div>
        </div>
        <a href="/generate" className="btn btn-sm">+ New Run</a>
      </div>
      <div className="content">
        {jobs.length === 0 ? (
          <div className="card"><div className="empty">No scrape runs yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Run a category →</a></div></div>
        ) : (
          jobs.map((j, i) => {
            const items: any[] = j.payload?.items || [];
            const cats = [...new Set(items.map((it) => it.category))].filter(Boolean).join(', ') || '—';
            const stats: Record<string, any> = j.source_stats || {};
            return (
              <details key={j.id} className="run-item" open={i === 0}>
                <summary className="run-head">
                  <span style={{ fontSize: 16 }}>🛰️</span>
                  <span className="run-cat">{cats}</span>
                  <span className={`badge ${STATUS_BADGE[j.status] || 'badge-gray'}`}>{j.status}</span>
                  <span className="badge badge-gray">{j.trigger}</span>
                  <span className="run-spacer" />
                  <span className="run-meta">found {j.found_count} · +{j.inserted_count} new · {j.updated_count} merged{j.blocked_count ? ` · ${j.blocked_count} blocked` : ''}</span>
                  <span className="run-meta" style={{ minWidth: 150, textAlign: 'right' }}>{fmtTime(j.created_at)}</span>
                </summary>
                <div className="log-block">
                  <div className="log-line"><span className="log-info">[JOB]</span> #{j.id} · runner={j.runner_mode} · status={j.status}</div>
                  {Object.keys(stats).length === 0 ? (
                    <div className="log-line log-warn">no per-source stats recorded</div>
                  ) : (
                    Object.entries(stats).map(([src, s]: any) => (
                      <div key={src} className="log-line">
                        <span className="log-ts">{src} </span>
                        <span className={s?.status === 'ok' ? 'log-success' : 'log-warn'}>[{(s?.status || '?').toUpperCase()}] </span>
                        <span>found {s?.found ?? 0}, enriched {s?.enriched ?? 0}{s?.error ? ` — ${s.error}` : ''}</span>
                      </div>
                    ))
                  )}
                  {j.error && <div className="log-line log-warn">[ERROR] {j.error}</div>}
                  {j.gh_run_url && <div className="log-line" style={{ marginTop: 8 }}><a href={j.gh_run_url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>▶ View the GitHub Actions run ↗</a></div>}
                </div>
              </details>
            );
          })
        )}
      </div>
    </>
  );
}
