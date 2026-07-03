import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const statusColor: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#fef3c7', fg: '#b45309' },
  accepted: { bg: '#dcfce7', fg: '#15803d' },
  rejected: { bg: '#fee2e2', fg: '#dc2626' },
  fulfilled: { bg: '#dbeafe', fg: '#1d4ed8' },
};

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function setStatus(formData: FormData) {
  'use server';
  const id = formData.get('id');
  const status = formData.get('status');
  await supabaseAdmin.from('buyer_requests').update({ status }).eq('id', id);
  revalidatePath('/requests');
}

export default async function RequestsPage() {
  let requests: any[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('buyer_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    requests = data || [];
  } catch (e) {
    console.error('Error fetching requests:', e);
  }

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Buyer Requests</h1>
        {pending > 0 && (
          <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.5rem 1rem', borderRadius: '999px', fontWeight: 600, fontSize: '0.875rem' }}>
            {pending} pending
          </span>
        )}
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        {requests.length === 0 ? (
          <p style={{ color: '#9ca3af', padding: '2rem 0', textAlign: 'center', margin: 0 }}>
            No buyer requests yet. They arrive automatically when someone submits the Google Form.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Buyer</th>
                  <th style={{ textAlign: 'left' }}>Wants</th>
                  <th style={{ textAlign: 'left' }}>Qty</th>
                  <th style={{ textAlign: 'left' }}>Offer</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const sc = statusColor[r.status] || { bg: '#f3f4f6', fg: '#6b7280' };
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.buyer_name}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{r.buyer_email}</div>
                      </td>
                      <td>{label(r.category_wanted)}</td>
                      <td style={{ color: '#4b5563' }}>{r.quantity_wanted ?? '—'}</td>
                      <td style={{ color: '#4b5563' }}>{r.price_offered != null ? `$${Number(r.price_offered).toFixed(2)}` : '—'}</td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.fg, padding: '0.25rem 0.625rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {label(r.status)}
                        </span>
                      </td>
                      <td>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="accepted" />
                              <button type="submit" style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}>Accept</button>
                            </form>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="rejected" />
                              <button type="submit" style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', boxShadow: 'none' }}>Reject</button>
                            </form>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>—</span>
                        )}
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
