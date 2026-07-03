import { supabaseAdmin } from '@/lib/supabase';
import { CATEGORY_META, LeadCategory } from '@/lib/leadGenerator';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['all', ...(Object.keys(CATEGORY_META) as LeadCategory[])];
const STATUSES = ['all', 'new', 'contacted', 'sold', 'invalid'];
const statusBadge: Record<string, string> = { new: 'badge-blue', contacted: 'badge-amber', sold: 'badge-green', invalid: 'badge-red' };

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function LeadsPage({ searchParams }: { searchParams: { category?: string; status?: string } }) {
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';

  let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
  if (category !== 'all') query = query.eq('category', category);
  if (status !== 'all') query = query.eq('status', status);

  let leads: any[] = [];
  try { leads = (await query).data || []; } catch {}

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Leads</h1>
          <div className="sub">Every lead captured across your sources</div>
        </div>
        <a href="/generate" className="btn btn-sm">+ Generate Leads</a>
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="field-label">Category</div>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <a key={c} href={`/leads?category=${c}&status=${status}`} className={`chip${category === c ? ' active' : ''}`}>{c === 'all' ? 'All' : label(c)}</a>
            ))}
          </div>
          <div className="field-label">Status</div>
          <div className="chip-row">
            {STATUSES.map((s) => (
              <a key={s} href={`/leads?category=${category}&status=${s}`} className={`chip${status === s ? ' active' : ''}`}>{label(s)}</a>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>{leads.length} lead{leads.length === 1 ? '' : 's'}</div>
          {leads.length === 0 ? (
            <div className="empty">No leads match this filter. <a href="/generate" style={{ color: 'var(--brand)', fontWeight: 600 }}>Generate some →</a></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Category</th><th>Contact</th><th>Company</th><th>Location</th><th>Source</th><th>Status</th></tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className="cell-strong">{l.name || '—'}</td>
                      <td>{CATEGORY_META[l.category as LeadCategory]?.icon} {label(l.category)}</td>
                      <td className="cell-muted">{l.email || l.phone || '—'}</td>
                      <td className="cell-muted">{l.company || '—'}</td>
                      <td className="cell-muted">{l.location || '—'}</td>
                      <td className="cell-muted">{l.source || '—'}</td>
                      <td><span className={`badge ${statusBadge[l.status] || 'badge-gray'}`}>{label(l.status)}</span></td>
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
