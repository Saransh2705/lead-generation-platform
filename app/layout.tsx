import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lead Generation Platform',
  description: 'Autonomous lead generation & sales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          background: 'white',
          padding: '1rem',
          borderBottom: '2px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Lead Gen Platform
            </h1>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <a href="/" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s', borderBottom: '2px solid transparent' }} onMouseEnter={(e) => e.target.style.color = '#3b82f6'} onMouseLeave={(e) => e.target.style.color = '#1f2937'}>Dashboard</a>
              <a href="/leads" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s', borderBottom: '2px solid transparent' }} onMouseEnter={(e) => e.target.style.color = '#3b82f6'} onMouseLeave={(e) => e.target.style.color = '#1f2937'}>Leads</a>
              <a href="/requests" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s', borderBottom: '2px solid transparent' }} onMouseEnter={(e) => e.target.style.color = '#3b82f6'} onMouseLeave={(e) => e.target.style.color = '#1f2937'}>Requests</a>
              <a href="/payments" style={{ color: '#1f2937', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s', borderBottom: '2px solid transparent' }} onMouseEnter={(e) => e.target.style.color = '#3b82f6'} onMouseLeave={(e) => e.target.style.color = '#1f2937'}>Payments</a>
            </div>
          </div>
        </nav>
        <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
