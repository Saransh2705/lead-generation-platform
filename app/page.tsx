import { supabaseAdmin } from '@/lib/supabase';

export default async function Dashboard() {
  let payments: any[] = [];
  let requests: any[] = [];

  try {
    const result = await supabaseAdmin.from('payments').select('*').limit(100);
    payments = result.data || [];
  } catch (e) {
    console.error('Error fetching payments:', e);
  }

  try {
    const result = await supabaseAdmin.from('buyer_requests').select('*').limit(100);
    requests = result.data || [];
  } catch (e) {
    console.error('Error fetching requests:', e);
  }
  
  const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const pendingCount = requests.filter((r: any) => r.status === 'pending').length;

  return (
    <div>
      <h1 style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', color: '#1f2937'}}>Dashboard</h1>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem'}}>
        <div className="card">
          <h3 style={{fontSize: '0.875rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.5rem'}}>Total Revenue</h3>
          <p style={{fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0}}>
            ${totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <h3 style={{fontSize: '0.875rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.5rem'}}>Pending Buyer Requests</h3>
          <p style={{fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6', margin: 0}}>{pendingCount}</p>
        </div>
      </div>
    </div>
  );
}
