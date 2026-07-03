import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['all', 'real_estate_buyer', 'real_estate_seller', 'mortgage', 'insurance', 'b2b'];
const STATUSES = ['all', 'new', 'contacted', 'sold', 'invalid'];

const statusColor: Record<string, { bg: string; fg: string }> = {
  new: { bg: '#dbeafe', fg: '#1d4ed8' },
  contacted: { bg: '#fef3c7', fg: '#b45309' },
  sold: { bg: '#dcfce7', fg: '#15803d' },
  invalid: { bg: '#fee2e2', fg: '#dc2626' },
};

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { category?: string; status?: string };
}) {
  const category = searchParams.category || 'all';
  const status = searchParams.status || 'all';

  let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
  if (category !== 'all') query = query.eq('category', category);
  if (status !== 'all') query = query.eq('status', status);

  let leads: any[] = [];
  try {
    const { data } = await query;
    leads = data || [];
  } catch (e) {
    console.error('Error fetching leads:', e);
  }

  const chip = (active: boolean) => ({
    padding: '0.375rem 0.875rem',
    borderRadius: '999px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    textDecoration: 'none',
    border: '1px solid',
    borderColor: active ? '#2563eb' : '#d1d5db',
    background: active ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'white',
    color: active ? 'white' : '#4b5563',
  });

  return (
    <div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>Leads</h1>

      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {CATEGORIES.map((c) => (
            <a key={c} href={`/leads?category=${c}&status=${status}`} style={chip(category === c)}>{label(c)}</a>
          ))}
        </div>
        <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {STATUSES.map((s) => (
            <a key={s} href={`/leads?category=${category}&status=${s}`} style={chip(status === s)}>{label(s)}</a>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
            {leads.length} lead{leads.length === 1 ? '' : 's'}
          </h3>
        </div>
        {leads.length === 0 ? (
          <p style={{ color: '#9ca3af', padding: '2rem 0', textAlign: 'center', margin: 0 }}>
            No leads match this filter. Leads populate automatically from the scrapers.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Category</th>
                  <th style={{ textAlign: 'left' }}>Contact</th>
                  <th style={{ textAlign: 'left' }}>Company</th>
                  <th style={{ textAlign: 'left' }}>Source</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const sc = statusColor[l.status] || { bg: '#f3f4f6', fg: '#6b7280' };
                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 500 }}>{l.name || '—'}</td>
                      <td>{label(l.category)}</td>
                      <td style={{ color: '#4b5563', fontSize: '0.875rem' }}>{l.email || l.phone || l.linkedin_url || '—'}</td>
                      <td style={{ color: '#4b5563' }}>{l.company || '—'}</td>
                      <td style={{ color: '#4b5563' }}>{l.source || '—'}</td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.fg, padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {label(l.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
