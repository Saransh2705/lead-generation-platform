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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem'}}>Admin Login</h1>
        {error && <div style={{ color: '#ef5350', marginBottom: '1rem' }}>{error}</div>}
        <input
          type="password"
          placeholder="Password: admin123"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        <button type="submit" style={{ width: '100%' }}>Login</button>
      </form>
    </div>
  );
}
