'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      document.cookie = `admin-token=${password}; path=/; max-age=604800`;
      router.push('/');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#eef3fc 0%,#e2ecfb 100%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(37,99,235,0.35)' }}>LG</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>LeadGen Automation</div>
          <div style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>Sign in to your control panel</div>
        </div>
        <form onSubmit={handleSubmit} className="card">
          <label className="field-label">Password</label>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 12px', borderRadius: 10, marginBottom: 12, border: '1px solid #fca5a5', fontSize: 13 }}>{error}</div>}
          <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus style={{ width: '100%', marginBottom: 16 }} />
          <button type="submit" style={{ width: '100%' }}>Sign In</button>
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 14, marginBottom: 0 }}>Demo password: <code style={{ background: '#eff4ff', padding: '2px 8px', borderRadius: 6, color: '#2563eb', fontFamily: 'monospace' }}>admin123</code></p>
        </form>
      </div>
    </div>
  );
}
