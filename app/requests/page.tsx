import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { CATEGORY_META, LeadCategory } from '@/lib/leadGenerator';

export const dynamic = 'force-dynamic';

const statusBadge: Record<string, string> = { pending: 'badge-amber', accepted: 'badge-green', rejected: 'badge-red', fulfilled: 'badge-blue' };

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function setStatus(formData: FormData) {
  'use server';
  const id = formData.get('id');
  const status = formData.get('status');
  await supabaseAdmin.from('buyer_requests').update({ status }).eq('id', id);
  revalidatePath('/requests');
  revalidatePath('/');
}

export default async function RequestsPage() {
  let requests: any[] = [];
  try {
    requests = (await supabaseAdmin.from('buyer_requests').select('*').order('created_at', { ascending: false }).limit(200)).data || [];
  } catch {}
  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Buyer Requests</h1>
          <div className="sub">Buyers who want to purchase your leads</div>
        </div>
        {pending > 0 && <span className="badge badge-amber">{pending} pending</span>}
      </div>
      <div className="content">
        <div className="card">
          {requests.length === 0 ? (
            <div className="empty">No buyer requests yet. They arrive automatically when someone submits the Google Form.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Buyer</th><th>Wants</th><th>Qty</th><th>Offer</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cell-strong">{r.buyer_name}</div>
                        <div className="cell-muted">{r.buyer_email}</div>
                      </td>
                      <td>{CATEGORY_META[r.category_wanted as LeadCategory]?.icon} {label(r.category_wanted)}</td>
                      <td className="cell-muted">{r.quantity_wanted ?? '—'}</td>
                      <td className="cell-muted">{r.price_offered != null ? `$${Number(r.price_offered).toFixed(2)}` : '—'}</td>
                      <td><span className={`badge ${statusBadge[r.status] || 'badge-gray'}`}>{label(r.status)}</span></td>
                      <td>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="accepted" />
                              <button type="submit" className="btn-sm">Accept</button>
                            </form>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="rejected" />
                              <button type="submit" className="btn-danger btn-sm">Reject</button>
                            </form>
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
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
