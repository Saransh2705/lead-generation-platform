import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['real_estate_buyer', 'real_estate_seller', 'mortgage', 'insurance', 'b2b'];

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
  try {
    const { data } = await supabaseAdmin.from('payments').select('*').order('date', { ascending: false }).limit(200);
    payments = data || [];
  } catch (e) {
    console.error('Error fetching payments:', e);
  }

  const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const inputStyle = { width: '100%' };
  const fieldLabel = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.375rem' };

  return (
    <div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>Payments</h1>

      <div className="card" style={{ marginTop: 0, background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe' }}>
        <h3 style={{ fontSize: '0.875rem', color: '#1d4ed8', fontWeight: 600, marginBottom: '0.25rem' }}>Total Revenue Logged</h3>
        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>${total.toFixed(2)}</p>
        <p style={{ color: '#3b82f6', fontSize: '0.8125rem', margin: '0.25rem 0 0' }}>{payments.length} payment{payments.length === 1 ? '' : 's'} recorded</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', marginBottom: '1rem' }}>Log a Payment</h3>
        <form action={addPayment}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={fieldLabel}>Buyer Name *</label>
              <input name="buyer_name" required placeholder="Jane Doe" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Buyer Email *</label>
              <input name="buyer_email" type="email" required placeholder="jane@example.com" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Amount (USD) *</label>
              <input name="amount" type="number" step="0.01" min="0" required placeholder="500.00" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Category</label>
              <select name="category" style={inputStyle} defaultValue="">
                <option value="">— none —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{label(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={fieldLabel}>Quantity</label>
              <input name="quantity" type="number" min="0" placeholder="50" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Notes</label>
              <input name="notes" placeholder="Optional" style={inputStyle} />
            </div>
          </div>
          <button type="submit">Record Payment</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', marginBottom: '0.5rem' }}>Payment History</h3>
        {payments.length === 0 ? (
          <p style={{ color: '#9ca3af', padding: '2rem 0', textAlign: 'center', margin: 0 }}>
            No payments logged yet. Use the form above to record your first sale.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Buyer</th>
                  <th style={{ textAlign: 'left' }}>Category</th>
                  <th style={{ textAlign: 'left' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: '#4b5563', fontSize: '0.875rem' }}>{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.buyer_name}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{p.buyer_email}</div>
                    </td>
                    <td style={{ color: '#4b5563' }}>{p.category ? label(p.category) : '—'}</td>
                    <td style={{ color: '#4b5563' }}>{p.quantity ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#15803d' }}>${Number(p.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
