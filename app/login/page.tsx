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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8f9fb 0%, #f0f4f8 100%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0, marginBottom: '0.5rem'}}>
            Lead Gen Platform
          </h1>
          <p style={{color: '#6b7280', margin: 0}}>Admin Access</p>
        </div>
        <form onSubmit={handleSubmit} className="card" style={{ width: '100%' }}>
          <h2 style={{fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937'}}>Welcome Back</h2>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #fca5a5', fontSize: '0.875rem' }}>{error}</div>}
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ width: '100%', marginBottom: '1.5rem' }}
          />
          <button type="submit" style={{ width: '100%', fontSize: '1rem', fontWeight: 600 }}>Sign In</button>
          <p style={{textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem', marginBottom: 0}}>Demo password: <code style={{background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', color: '#3b82f6', fontFamily: 'monospace'}}>admin123</code></p>
        </form>
      </div>
    </div>
  );
}
