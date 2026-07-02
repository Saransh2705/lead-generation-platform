import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lead Generation Platform',
  description: 'Autonomous lead generation & sales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#111827', color: 'white' }}>
        <nav style={{ background: '#1f2937', padding: '1rem', borderBottom: '1px solid #374151' }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Lead Gen Platform</h1>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Dashboard</a>
              <a href="/leads" style={{ color: 'inherit', textDecoration: 'none' }}>Leads</a>
              <a href="/requests" style={{ color: 'inherit', textDecoration: 'none' }}>Requests</a>
              <a href="/payments" style={{ color: 'inherit', textDecoration: 'none' }}>Payments</a>
            </div>
          </div>
        </nav>
        <main style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
