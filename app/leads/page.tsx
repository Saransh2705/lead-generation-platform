import { supabaseAdmin } from '@/lib/supabase';
import ExportMenu from '@/app/components/ExportMenu';

export const dynamic = 'force-dynamic';

const STATUSES = ['all', 'new', 'contacted', 'sold', 'invalid'];
const CONTACT_FILTERS = [
  { key: 'all', label: 'Any' },
  { key: 'email', label: 'Has Email' },
  { key: 'phone', label: 'Has Phone' },
  { key: 'linkedin', label: 'Has LinkedIn' },
  { key: 'website', label: 'Has Website' },
];
const statusBadge: Record<string, string> = { new: 'badge-blue', contacted: 'badge-amber', sold: 'badge-green', invalid: 'badge-red' };

// Toggleable columns. `contacts` is a display-only combined column.
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
];
const DEFAULT_COLS = ['name', 'contacts', 'brief', 'category', 'status'];

function label(v: string) { return (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export default async function LeadsPage({ searchParams }: { searchParams: Record<string, string> }) {
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';
  const has = searchParams.has || 'all';
  const cols = (searchParams.cols ? searchParams.cols.split(',').filter((c) => ALL_COLS.some((x) => x.key === c)) : DEFAULT_COLS);
  const activeCols = cols.length ? cols : DEFAULT_COLS;

  const { data: categoriesData } = await supabaseAdmin.from('categories').select('key,label,icon').order('id');
  const catMap: Record<string, any> = {};
  for (const c of categoriesData || []) catMap[c.key] = c;
  const catList = ['all', ...(categoriesData || []).map((c: any) => c.key)];

  let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false }).limit(500);
  if (category !== 'all') query = query.eq('category', category);
  if (status !== 'all') query = query.eq('status', status);
  if (has === 'email') query = query.not('email', 'is', null);
  if (has === 'phone') query = query.not('phone', 'is', null);
  if (has === 'linkedin') query = query.not('linkedin_url', 'is', null);
  if (has === 'website') query = query.not('website', 'is', null);

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

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ category, status, has, cols: activeCols.join(',') });
    for (const [k, v] of Object.entries(over)) p.set(k, v);
    return `/leads?${p.toString()}`;
  };
  const toggleCol = (key: string) => {
    const set = new Set(activeCols);
    set.has(key) ? set.delete(key) : set.add(key);
    const next = ALL_COLS.map((c) => c.key).filter((k) => set.has(k));
    return qs({ cols: next.join(',') || 'name' });
  };

  const chipStyle = (active: boolean) => `chip${active ? ' active' : ''}`;
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
          <div className="field-label">Category</div>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {catList.map((c) => (
              <a key={c} href={qs({ category: c })} className={chipStyle(category === c)}>{c === 'all' ? 'All' : `${catMap[c]?.icon || ''} ${catMap[c]?.label || label(c)}`}</a>
            ))}
          </div>
          <div className="field-label">Status</div>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {STATUSES.map((s) => <a key={s} href={qs({ status: s })} className={chipStyle(status === s)}>{label(s)}</a>)}
          </div>
          <div className="field-label">Contacts</div>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {CONTACT_FILTERS.map((f) => <a key={f.key} href={qs({ has: f.key })} className={chipStyle(has === f.key)}>{f.label}</a>)}
          </div>
          <div className="field-label">Columns</div>
          <div className="chip-row">
            {ALL_COLS.map((c) => <a key={c.key} href={toggleCol(c.key)} className={chipStyle(activeCols.includes(c.key))}>{c.header}</a>)}
          </div>
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
