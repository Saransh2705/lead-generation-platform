import { supabaseAdmin } from '@/lib/supabase';
import ExportMenu from '@/app/components/ExportMenu';
import LeadsFilters from '@/app/components/LeadsFilters';
import LocalTime from '@/app/components/LocalTime';

export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'new', 'contacted', 'sold', 'invalid'];
const STATUS_OPTS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'sold', label: 'Sold' },
  { value: 'invalid', label: 'Invalid' },
];
const CONTACT_OPTS = [
  { value: 'all', label: 'Any contact' },
  { value: 'email', label: 'Has Email' },
  { value: 'phone', label: 'Has Phone' },
  { value: 'linkedin', label: 'Has LinkedIn' },
  { value: 'website', label: 'Has Website' },
];
const DATE_OPTS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range…' },
];
const statusBadge: Record<string, string> = { new: 'badge-blue', contacted: 'badge-amber', sold: 'badge-green', invalid: 'badge-red' };

// Toggleable columns. `contacts` is a display-only combined column; `created_at` shows the fetch time.
const ALL_COLS = [
  { key: 'name', header: 'Name' },
  { key: 'contacts', header: 'Contacts' },
  { key: 'brief', header: 'Brief' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'linkedin_url', header: 'LinkedIn' },
  { key: 'website', header: 'Website' },
  { key: 'company', header: 'Company' },
  { key: 'location', header: 'Location' },
  { key: 'category', header: 'Category' },
  { key: 'source', header: 'Source' },
  { key: 'status', header: 'Status' },
  { key: 'created_at', header: 'Fetched' },
];
const DEFAULT_COLS = ['name', 'contacts', 'brief', 'category', 'status', 'created_at'];

function label(v: string) { return (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

// Lower bound (inclusive) for a date preset, as an ISO string — or null for "all time".
function presetCutoff(preset: string): string | null {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  if (preset === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (preset === '7d') return new Date(now.getTime() - 7 * day).toISOString();
  if (preset === '30d') return new Date(now.getTime() - 30 * day).toISOString();
  if (preset === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return null;
}

export default async function LeadsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';
  const has = searchParams.has || 'all';
  const date = searchParams.date || 'all';
  const from = searchParams.from || '';
  const to = searchParams.to || '';
  const cols = (searchParams.cols ? searchParams.cols.split(',').filter((c) => ALL_COLS.some((x) => x.key === c)) : DEFAULT_COLS);
  const activeCols = cols.length ? cols : DEFAULT_COLS;

  const { data: categoriesData } = await supabaseAdmin.from('categories').select('key,label,icon').order('id');
  const catMap: Record<string, any> = {};
  for (const c of categoriesData || []) catMap[c.key] = c;
  const categoryOpts = [
    { value: 'all', label: 'All Categories' },
    ...(categoriesData || []).map((c: any) => ({ value: c.key, label: `${c.icon || ''} ${c.label || label(c.key)}`.trim() })),
  ];

  let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false }).limit(500);
  if (category !== 'all') query = query.eq('category', category);
  if (status !== 'all') query = query.eq('status', status);
  if (has === 'email') query = query.not('email', 'is', null);
  if (has === 'phone') query = query.not('phone', 'is', null);
  if (has === 'linkedin') query = query.not('linkedin_url', 'is', null);
  if (has === 'website') query = query.not('website', 'is', null);
  // Date-fetched filter (on created_at).
  if (date === 'custom') {
    if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lte('created_at', new Date(`${to}T23:59:59.999`).toISOString());
  } else {
    const cut = presetCutoff(date);
    if (cut) query = query.gte('created_at', cut);
  }

  let leads: any[] = [];
  try { leads = (await query).data || []; } catch {}

  // Enrich rows with a readable category label for display + export.
  const rows = leads.map((l) => ({ ...l, category_label: catMap[l.category]?.label || label(l.category) }));

  // Build export fields from selected columns (expand `contacts`, map `category`).
  const exportFields: { key: string; header: string }[] = [];
  for (const key of activeCols) {
    if (key === 'contacts') {
      exportFields.push({ key: 'email', header: 'Email' }, { key: 'phone', header: 'Phone' }, { key: 'linkedin_url', header: 'LinkedIn' }, { key: 'website', header: 'Website' });
    } else if (key === 'category') {
      exportFields.push({ key: 'category_label', header: 'Category' });
    } else {
      exportFields.push(ALL_COLS.find((c) => c.key === key)!);
    }
  }

  const contactChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: '#eef4ff', color: '#1d4ed8', marginRight: 5, marginBottom: 3 };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Leads</h1>
          <div className="sub">Every lead captured across your sources</div>
        </div>
        <ExportMenu rows={rows} fields={exportFields} />
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 20 }}>
          <LeadsFilters
            category={category} status={status} has={has} date={date} from={from} to={to} cols={activeCols}
            categoryOpts={categoryOpts} statusOpts={STATUS_OPTS} contactOpts={CONTACT_OPTS} dateOpts={DATE_OPTS} allCols={ALL_COLS}
          />
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>{rows.length} lead{rows.length === 1 ? '' : 's'}</div>
          {rows.length === 0 ? (
            <div className="empty">No leads match this filter. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Generate some →</a></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>{activeCols.map((k) => <th key={k}>{ALL_COLS.find((c) => c.key === k)?.header}</th>)}</tr></thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      {activeCols.map((k) => {
                        if (k === 'name') return <td key={k} className="cell-strong">{l.name || '—'}</td>;
                        if (k === 'contacts') return (
                          <td key={k}>
                            {l.email && <span style={contactChip}>✉ {l.email}</span>}
                            {l.phone && <span style={contactChip}>☎ {l.phone}</span>}
                            {l.linkedin_url && <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ ...contactChip, textDecoration: 'none' }}>in LinkedIn</a>}
                            {l.website && <a href={l.website} target="_blank" rel="noreferrer" style={{ ...contactChip, textDecoration: 'none' }}>🌐 Site</a>}
                            {!l.email && !l.phone && !l.linkedin_url && !l.website && <span className="cell-muted">—</span>}
                          </td>
                        );
                        if (k === 'brief') return <td key={k} className="cell-muted" style={{ maxWidth: 320 }}><span title={l.brief || ''}>{l.brief || '—'}</span></td>;
                        if (k === 'linkedin_url') return <td key={k}>{l.linkedin_url ? <a href={l.linkedin_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>profile</a> : <span className="cell-muted">—</span>}</td>;
                        if (k === 'website') return <td key={k}>{l.website ? <a href={l.website} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>site</a> : <span className="cell-muted">—</span>}</td>;
                        if (k === 'category') return <td key={k}>{catMap[l.category]?.icon} {l.category_label}</td>;
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
