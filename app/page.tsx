import { supabaseAdmin } from '@/lib/supabase';
import { CATEGORY_META, LeadCategory } from '@/lib/leadGenerator';

export const dynamic = 'force-dynamic';

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function Dashboard() {
  let leads: any[] = [], payments: any[] = [], requests: any[] = [], runs: any[] = [];
  try { leads = (await supabaseAdmin.from('leads').select('category,status').limit(2000)).data || []; } catch {}
  try { payments = (await supabaseAdmin.from('payments').select('amount').limit(1000)).data || []; } catch {}
  try { requests = (await supabaseAdmin.from('buyer_requests').select('status').limit(1000)).data || []; } catch {}
  try { runs = (await supabaseAdmin.from('generation_runs').select('*').order('created_at', { ascending: false }).limit(6)).data || []; } catch {}

  const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pending = requests.filter((r) => r.status === 'pending').length;
  let totalRuns = 0;
  try { const { count } = await supabaseAdmin.from('generation_runs').select('*', { count: 'exact', head: true }); totalRuns = count || 0; } catch {}

  const byCat = (Object.keys(CATEGORY_META) as LeadCategory[]).map((c) => ({
    key: c, label: CATEGORY_META[c].label, icon: CATEGORY_META[c].icon,
    count: leads.filter((l) => l.category === c).length,
  }));
  const maxCat = Math.max(1, ...byCat.map((c) => c.count));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Overview of your lead-generation pipeline</div>
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
            <div className="stat-icon">💰</div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value grad">${totalRevenue.toFixed(2)}</div>
            <div className="stat-foot">{payments.length} payment{payments.length === 1 ? '' : 's'} logged</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📨</div>
            <div className="stat-label">Pending Requests</div>
            <div className="stat-value">{pending}</div>
            <div className="stat-foot">buyers awaiting response</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-label">Generation Runs</div>
            <div className="stat-value">{totalRuns}</div>
            <div className="stat-foot">lead-gen jobs executed</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20 }} className="dash-cols">
          <div className="card">
            <div className="card-title">Leads by Category</div>
            <div className="card-sub">Distribution across your lead sources</div>
            {byCat.map((c) => (
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
            <div className="card-sub">Latest lead-generation jobs</div>
            {runs.length === 0 ? (
              <div className="empty">No runs yet. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Run one →</a></div>
            ) : (
              runs.map((r) => (
                <div key={r.id} className="row-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{CATEGORY_META[r.category as LeadCategory]?.icon} {label(r.category)}</div>
                    <div className="cell-muted">{timeAgo(r.created_at)} · {r.leads_generated} leads</div>
                  </div>
                  <span className={`badge ${r.status === 'completed' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{label(r.status)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
