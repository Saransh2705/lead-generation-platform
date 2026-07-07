import { supabaseAdmin } from '@/lib/supabase';
import ExportMenu from '@/app/components/ExportMenu';
import LeadsFilters from '@/app/components/LeadsFilters';
import LocalTime from '@/app/components/LocalTime';

export const dynamic = 'force-dynamic';

const STATUS_OPTS = [
  { value: 'all', label: 'All Statuses' }, { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' }, { value: 'sold', label: 'Sold' }, { value: 'invalid', label: 'Invalid' },
];
const CONTACT_OPTS = [
  { value: 'all', label: 'Any contact' }, { value: 'email', label: 'Has Email' }, { value: 'phone', label: 'Has Phone' }, { value: 'linkedin', label: 'Has LinkedIn' }, { value: 'website', label: 'Has Website' },
];
const DATE_OPTS = [
  { value: 'all', label: 'All time' }, { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: 'month', label: 'This month' }, { value: 'custom', label: 'Custom range…' },
];
const CONF_OPTS = [
  { value: 'all', label: 'Any confidence' }, { value: 'high', label: 'High (70+)' }, { value: 'medium', label: 'Medium (40–69)' }, { value: 'low', label: 'Low (<40)' },
];
const MODE_OPTS = [
  { value: 'all', label: 'Real + sample' }, { value: 'scraped', label: 'Real (scraped)' }, { value: 'sample', label: 'Sample only' },
];
const statusBadge: Record<string, string> = { new: 'badge-blue', contacted: 'badge-amber', sold: 'badge-green', invalid: 'badge-red' };
const SOCIAL_ICON: Record<string, string> = { linkedin: 'in', facebook: 'f', instagram: 'ig', twitter: 'x', github: 'gh', youtube: 'yt', tiktok: 'tk', whatsapp: 'wa', telegram: 'tg', pinterest: 'pin', yelp: 'yelp', reddit: 'rd', threads: 'th' };

const ALL_COLS = [
  { key: 'logo', header: 'Logo' },
  { key: 'name', header: 'Name' },
  { key: 'description', header: 'Description' },
  { key: 'contacts', header: 'Contacts' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'verify', header: 'Verified' },
  { key: 'socials', header: 'Socials' },
  { key: 'brief', header: 'Brief' },
  { key: 'location', header: 'Location' },
  { key: 'city', header: 'City' },
  { key: 'state', header: 'State' },
  { key: 'country', header: 'Country' },
  { key: 'category', header: 'Category' },
  { key: 'source_key', header: 'Source' },
  { key: 'mode', header: 'Mode' },
  { key: 'dedup_count', header: 'Dupes' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'website', header: 'Website' },
  { key: 'status', header: 'Status' },
  { key: 'created_at', header: 'Fetched' },
];
const DEFAULT_COLS = ['logo', 'name', 'description', 'contacts', 'confidence', 'country', 'category', 'created_at'];

function label(v: string) { return (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function presetCutoff(preset: string): string | null {
  const now = new Date(); const day = 864e5;
  if (preset === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (preset === '7d') return new Date(now.getTime() - 7 * day).toISOString();
  if (preset === '30d') return new Date(now.getTime() - 30 * day).toISOString();
  if (preset === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
}
function confColor(c: number) { return c >= 70 ? 'badge-green' : c >= 40 ? 'badge-amber' : 'badge-red'; }

export default async function LeadsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';
  const has = searchParams.has || 'all';
  const date = searchParams.date || 'all';
  const conf = searchParams.conf || 'all';
  const src = searchParams.src || 'all';
  const mode = searchParams.mode || 'all';
  const fCountry = searchParams.country || 'all';
  const fState = searchParams.state || 'all';
  const fCity = searchParams.city || 'all';
  const from = searchParams.from || '';
  const to = searchParams.to || '';
  const cols = (searchParams.cols ? searchParams.cols.split(',').filter((c) => ALL_COLS.some((x) => x.key === c)) : DEFAULT_COLS);
  const activeCols = cols.length ? cols : DEFAULT_COLS;

  const { data: categoriesData } = await supabaseAdmin.from('categories').select('key,label,icon').order('label');
  const catMap: Record<string, any> = {};
  for (const c of categoriesData || []) catMap[c.key] = c;
  const categoryOpts = [{ value: 'all', label: 'All Categories' }, ...(categoriesData || []).map((c: any) => ({ value: c.key, label: `${c.icon || ''} ${c.label || label(c.key)}`.trim() }))];
  const { data: sourcesData } = await supabaseAdmin.from('sources').select('key,label').order('label');
  const sourceOpts = [{ value: 'all', label: 'All Sources' }, ...(sourcesData || []).map((s: any) => ({ value: s.key, label: s.label || s.key }))];

  // Cascading geo filter tree from actual lead data.
  const { data: geoRows } = await supabaseAdmin.from('leads').select('country,state,city').limit(5000);
  const geoTree: { country: string; state: string; city: string }[] = [];
  const seenGeo = new Set<string>();
  for (const g of geoRows || []) {
    const key = `${g.country || ''}|${g.state || ''}|${g.city || ''}`;
    if (g.country && !seenGeo.has(key)) { seenGeo.add(key); geoTree.push({ country: g.country, state: g.state || '', city: g.city || '' }); }
  }

  let query = supabaseAdmin.from('v_leads').select('*').order('created_at', { ascending: false }).limit(500);
  if (category !== 'all') query = query.eq('category', category);
  if (status !== 'all') query = query.eq('status', status);
  if (src !== 'all') query = query.eq('source_key', src);
  if (mode !== 'all') query = query.eq('mode', mode);
  if (fCountry !== 'all') query = query.eq('country', fCountry);
  if (fState !== 'all') query = query.eq('state', fState);
  if (fCity !== 'all') query = query.eq('city', fCity);
  if (has === 'email') query = query.not('email', 'is', null);
  if (has === 'phone') query = query.not('phone', 'is', null);
  if (has === 'linkedin') query = query.not('linkedin_url', 'is', null);
  if (has === 'website') query = query.not('website', 'is', null);
  if (conf === 'high') query = query.gte('confidence_effective', 70);
  else if (conf === 'medium') { query = query.gte('confidence_effective', 40).lt('confidence_effective', 70); }
  else if (conf === 'low') query = query.lt('confidence_effective', 40);
  if (date === 'custom') {
    if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lte('created_at', new Date(`${to}T23:59:59.999`).toISOString());
  } else { const cut = presetCutoff(date); if (cut) query = query.gte('created_at', cut); }

  let leads: any[] = [];
  try { leads = (await query).data || []; } catch {}
  const rows = leads.map((l) => ({ ...l, category_label: catMap[l.category]?.label || label(l.category) }));

  const exportFields: { key: string; header: string }[] = [];
  for (const key of activeCols) {
    if (key === 'contacts') exportFields.push({ key: 'email', header: 'Email' }, { key: 'phone', header: 'Phone' }, { key: 'website', header: 'Website' });
    else if (key === 'logo') exportFields.push({ key: 'logo_url', header: 'Logo' });
    else if (key === 'category') exportFields.push({ key: 'category_label', header: 'Category' });
    else if (key === 'socials' || key === 'verify') continue;
    else if (key === 'confidence') exportFields.push({ key: 'confidence_effective', header: 'Confidence' });
    else exportFields.push(ALL_COLS.find((c) => c.key === key)!);
  }

  const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: '#eef4ff', color: '#1d4ed8', marginRight: 5, marginBottom: 3 };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Leads</h1>
          <div className="sub">Real businesses scraped across your categories</div>
        </div>
        <ExportMenu rows={rows} fields={exportFields} />
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 20 }}>
          <LeadsFilters
            category={category} status={status} has={has} date={date} conf={conf} src={src} mode={mode}
            country={fCountry} state={fState} city={fCity} geoTree={geoTree} from={from} to={to} cols={activeCols}
            categoryOpts={categoryOpts} statusOpts={STATUS_OPTS} contactOpts={CONTACT_OPTS} dateOpts={DATE_OPTS}
            confOpts={CONF_OPTS} sourceOpts={sourceOpts} modeOpts={MODE_OPTS} allCols={ALL_COLS}
          />
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>{rows.length} lead{rows.length === 1 ? '' : 's'}</div>
          {rows.length === 0 ? (
            <div className="empty">No leads match this filter. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Scrape some →</a></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>{activeCols.map((k) => <th key={k}>{ALL_COLS.find((c) => c.key === k)?.header}</th>)}</tr></thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      {activeCols.map((k) => {
                        if (k === 'logo') return <td key={k}>{l.logo_url ? <img src={l.logo_url} alt="" referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)' }} /> : <span className="cell-muted">—</span>}</td>;
                        if (k === 'name') return <td key={k} className="cell-strong">{l.name || '—'}</td>;
                        if (k === 'description') return <td key={k} className="cell-muted" style={{ maxWidth: 340 }}><span title={l.description || ''} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.description || '—'}</span></td>;
                        if (k === 'contacts') return (
                          <td key={k}>
                            {l.email && <span style={chip}>✉ {l.email}</span>}
                            {l.phone && <span style={chip}>☎ {l.phone}</span>}
                            {l.website && <a href={l.website} target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: 'none' }}>🌐 Site</a>}
                            {!l.email && !l.phone && !l.website && <span className="cell-muted">—</span>}
                          </td>
                        );
                        if (k === 'confidence') return <td key={k}><span className={`badge ${confColor(l.confidence_effective ?? l.confidence ?? 0)}`}>{l.confidence_effective ?? l.confidence ?? 0}</span></td>;
                        if (k === 'verify') return (
                          <td key={k} style={{ whiteSpace: 'nowrap' }}>
                            {l.email_status && <span className={`badge ${l.email_status === 'ok' ? 'badge-green' : ['role', 'unknown', 'unverified'].includes(l.email_status) ? 'badge-amber' : 'badge-red'}`} style={{ marginRight: 4, fontSize: 10.5 }}>✉ {l.email_status === 'ok' ? 'MX✓' : l.email_status}</span>}
                            {l.phone_status && <span className={`badge ${l.phone_status === 'valid' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10.5 }}>☎ {l.phone_status}</span>}
                            {!l.email_status && !l.phone_status && <span className="cell-muted">—</span>}
                          </td>
                        );
                        if (k === 'socials') {
                          const s = l.socials || {};
                          const keys = Object.keys(s);
                          return <td key={k}>{keys.length ? keys.map((p) => <a key={p} href={s[p]} target="_blank" rel="noreferrer" title={p} style={{ ...chip, marginBottom: 0, textTransform: 'lowercase' }}>{SOCIAL_ICON[p] || p}</a>) : <span className="cell-muted">—</span>}</td>;
                        }
                        if (k === 'brief') return <td key={k} className="cell-muted" style={{ maxWidth: 300 }}><span title={l.brief || ''}>{l.brief || '—'}</span></td>;
                        if (k === 'website') return <td key={k}>{l.website ? <a href={l.website} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>site</a> : <span className="cell-muted">—</span>}</td>;
                        if (k === 'category') return <td key={k}>{catMap[l.category]?.icon} {l.category_label}</td>;
                        if (k === 'mode') return <td key={k}><span className={`badge ${l.mode === 'scraped' ? 'badge-blue' : 'badge-gray'}`}>{l.mode}</span></td>;
                        if (k === 'dedup_count') return <td key={k} className="cell-muted">{(l.dedup_count || 1) > 1 ? `×${l.dedup_count}` : '—'}</td>;
                        if (k === 'status') return <td key={k}><span className={`badge ${statusBadge[l.status] || 'badge-gray'}`}>{label(l.status)}</span></td>;
                        if (k === 'created_at') return <td key={k} className="cell-muted"><LocalTime iso={l.created_at} /></td>;
                        return <td key={k} className="cell-muted">{l[k] || '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
