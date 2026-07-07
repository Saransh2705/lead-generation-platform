import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function ago(iso: string | null) {
  if (!iso) return 'never';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
const STATUS: Record<string, { b: string; t: string }> = {
  ok: { b: 'badge-green', t: '✓ Working' },
  blocked: { b: 'badge-red', t: '⛔ Blocked' },
  empty: { b: 'badge-amber', t: 'No results' },
  error: { b: 'badge-red', t: '⚠ Error' },
};
const KIND: Record<string, string> = { osm: 'Open data', directory: 'Directory', maps: 'Maps', enrich: 'Enrichment', sample: 'Demo' };

export default async function SourcesPage() {
  let sources: any[] = [];
  try { sources = (await supabaseAdmin.from('sources').select('*').order('is_seed', { ascending: false }).order('label')).data || []; } catch {}

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Sources</h1>
          <div className="sub">Where leads come from — and whether each source is currently working</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,#eff4ff,#e0ebff)', border: '1px solid #c7d7fb' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22 }}>ℹ️</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              <strong>OpenStreetMap</strong> is the reliable engine. <strong>Yelp / Yellow Pages / Google Maps</strong> fight datacenter IPs (GitHub) and often show <strong>Blocked</strong> — that's the free-tier reality; high yield there needs residential proxies. Each source runs independently, so a block on one never stops the others. <strong>Website Enrichment</strong> always runs to pull emails/socials.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Source</th><th>Type</th><th>Status</th><th>Last run</th><th>Last yield</th><th>Details / reason</th></tr></thead>
              <tbody>
                {sources.map((s) => {
                  const st = s.last_status ? STATUS[s.last_status] : null;
                  return (
                    <tr key={s.key}>
                      <td className="cell-strong">
                        {s.icon} {s.label}
                        {!s.enabled && <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 10 }}>disabled</span>}
                        {s.requires_home_ip && <span className="badge badge-amber" style={{ marginLeft: 8, fontSize: 10 }}>Floura only</span>}
                        {s.login_required && <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: 10 }}>login</span>}
                      </td>
                      <td className="cell-muted">{KIND[s.kind] || s.kind}</td>
                      <td>{st ? <span className={`badge ${st.b}`}>{st.t}</span> : <span className="badge badge-gray">Never run</span>}
                        {s.consecutive_failures > 1 && <span className="cell-muted" style={{ marginLeft: 6, fontSize: 11.5 }}>×{s.consecutive_failures} fails</span>}
                      </td>
                      <td className="cell-muted">{ago(s.last_run_at)}</td>
                      <td className="cell-muted">{s.last_yield != null ? `${s.last_yield}` : '—'}</td>
                      <td className="cell-muted" style={{ maxWidth: 340 }}>
                        {s.last_error ? <span style={{ color: 'var(--red)' }} title={s.last_error}>{s.last_error}</span> : <span title={s.notes || ''}>{s.notes || '—'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
