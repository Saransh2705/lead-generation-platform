import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { CATEGORY_META, LeadCategory } from '@/lib/leadGenerator';

export const dynamic = 'force-dynamic';

const CATEGORIES = Object.keys(CATEGORY_META) as LeadCategory[];

function label(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function addPayment(formData: FormData) {
  'use server';
  const buyer_name = String(formData.get('buyer_name') || '').trim();
  const buyer_email = String(formData.get('buyer_email') || '').trim();
  const amount = parseFloat(String(formData.get('amount') || ''));
  if (!buyer_name || !buyer_email || isNaN(amount)) return;
  const category = String(formData.get('category') || '') || null;
  const quantityRaw = String(formData.get('quantity') || '');
  const quantity = quantityRaw ? parseInt(quantityRaw) : null;
  const notes = String(formData.get('notes') || '').trim() || null;

  await supabaseAdmin.from('payments').insert({ buyer_name, buyer_email, amount, category, quantity, notes });
  revalidatePath('/payments');
  revalidatePath('/');
}

export default async function PaymentsPage() {
  let payments: any[] = [];
  try { payments = (await supabaseAdmin.from('payments').select('*').order('date', { ascending: false }).limit(200)).data || []; } catch {}
  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Payments</h1>
          <div className="sub">Manual log of every completed sale</div>
        </div>
      </div>
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">💵</div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value grad">${total.toFixed(2)}</div>
            <div className="stat-foot">{payments.length} payment{payments.length === 1 ? '' : 's'} recorded</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Log a Payment</div>
          <div className="card-sub">Record a sale after you receive payment</div>
          <form action={addPayment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div><label className="field-label">Buyer Name *</label><input name="buyer_name" required placeholder="Jane Doe" style={{ width: '100%' }} /></div>
              <div><label className="field-label">Buyer Email *</label><input name="buyer_email" type="email" required placeholder="jane@example.com" style={{ width: '100%' }} /></div>
              <div><label className="field-label">Amount (USD) *</label><input name="amount" type="number" step="0.01" min="0" required placeholder="500.00" style={{ width: '100%' }} /></div>
              <div><label className="field-label">Category</label>
                <select name="category" defaultValue="" style={{ width: '100%' }}>
                  <option value="">— none —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                </select>
              </div>
              <div><label className="field-label">Quantity</label><input name="quantity" type="number" min="0" placeholder="50" style={{ width: '100%' }} /></div>
              <div><label className="field-label">Notes</label><input name="notes" placeholder="Optional" style={{ width: '100%' }} /></div>
            </div>
            <button type="submit">Record Payment</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Payment History</div>
          {payments.length === 0 ? (
            <div className="empty">No payments logged yet. Use the form above to record your first sale.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Buyer</th><th>Category</th><th>Qty</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-muted">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                      <td><div className="cell-strong">{p.buyer_name}</div><div className="cell-muted">{p.buyer_email}</div></td>
                      <td className="cell-muted">{p.category ? label(p.category) : '—'}</td>
                      <td className="cell-muted">{p.quantity ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>${Number(p.amount).toFixed(2)}</td>
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
