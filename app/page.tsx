import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function label(v: string) { return (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}
const STATUS_BADGE: Record<string, string> = { completed: 'badge-green', failed: 'badge-red', blocked: 'badge-red', stuck: 'badge-red', running: 'badge-amber', dispatched: 'badge-amber', queued: 'badge-gray' };

export default async function Dashboard() {
  let leads: any[] = [], runs: any[] = [], cats: any[] = [];
  try { leads = (await supabaseAdmin.from('leads').select('category').limit(5000)).data || []; } catch {}
  try { runs = (await supabaseAdmin.from('scrape_jobs').select('*').order('id', { ascending: false }).limit(6)).data || []; } catch {}
  try { cats = (await supabaseAdmin.from('categories').select('key,label,icon').order('label')).data || []; } catch {}

  let totalRuns = 0;
  try { const { count } = await supabaseAdmin.from('scrape_jobs').select('*', { count: 'exact', head: true }); totalRuns = count || 0; } catch {}
  let activeSchedules = 0;
  try { const { count } = await supabaseAdmin.from('schedules').select('*', { count: 'exact', head: true }).eq('enabled', true).eq('one_off', false); activeSchedules = count || 0; } catch {}

  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.category] = (counts[l.category] || 0) + 1;
  const byCat = cats.map((c: any) => ({ ...c, count: counts[c.key] || 0 })).sort((a, b) => b.count - a.count).slice(0, 8);
  const maxCat = Math.max(1, ...byCat.map((c) => c.count));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Overview of your lead-scraping pipeline</div>
        </div>
        <a href="/generate" className="btn btn-sm">+ Generate Leads</a>
      </div>
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-label">Total Leads</div>
            <div className="stat-value">{leads.length}</div>
            <div className="stat-foot">across {byCat.filter((c) => c.count).length} categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🗂️</div>
            <div className="stat-label">Categories</div>
            <div className="stat-value grad">{cats.length}</div>
            <div className="stat-foot"><a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>manage →</a></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🛰️</div>
            <div className="stat-label">Scrape Runs</div>
            <div className="stat-value">{totalRuns}</div>
            <div className="stat-foot">cloud jobs executed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-label">Active Schedules</div>
            <div className="stat-value">{activeSchedules}</div>
            <div className="stat-foot"><a href="/schedules" style={{ color: 'var(--brand)', fontWeight: 600 }}>manage →</a></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20 }} className="dash-cols">
          <div className="card">
            <div className="card-title">Leads by Category</div>
            <div className="card-sub">Distribution across your scraped categories</div>
            {byCat.length === 0 ? (
              <div className="empty">No categories yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Create one →</a></div>
            ) : byCat.map((c) => (
              <div key={c.key} style={{ marginBottom: 14 }}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{c.icon} {c.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{c.count}</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row-between" style={{ marginBottom: 4 }}>
              <span className="card-title">Recent Runs</span>
              <a href="/logs" style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600 }}>View all →</a>
            </div>
            <div className="card-sub">Latest cloud scrape jobs</div>
            {runs.length === 0 ? (
              <div className="empty">No runs yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Run one →</a></div>
            ) : runs.map((r) => {
              const cats = [...new Set((r.payload?.items || []).map((it: any) => it.category))].filter(Boolean).join(', ') || '—';
              return (
                <div key={r.id} className="row-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{cats}</div>
                    <div className="cell-muted">{timeAgo(r.created_at)} · +{r.inserted_count} new · {r.updated_count} merged</div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>{r.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
