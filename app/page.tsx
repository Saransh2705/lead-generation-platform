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
      <h1 style={{fontSize: '2.25rem', fontWeight: 'bold', marginBottom: '1.5rem'}}>Dashboard</h1>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
        <div className="card">
          <h3 style={{fontSize: '0.875rem', color: '#9ca3af'}}>Total Revenue</h3>
          <p style={{fontSize: '1.875rem', fontWeight: 'bold'}}>${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3 style={{fontSize: '0.875rem', color: '#9ca3af'}}>Pending Buyer Requests</h3>
          <p style={{fontSize: '1.875rem', fontWeight: 'bold'}}>{pendingCount}</p>
        </div>
      </div>
    </div>
  );
}
