#!/usr/bin/env node
/**
 * Generate all remaining Next.js files for the lead generation platform
 * Run: node generate-files.js
 */

import fs from 'fs';
import path from 'path';

const files = {
  'middleware.ts': `import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow webhook and public endpoints
  if (pathname === '/api/buyer-request-webhook' || pathname === '/login') {
    return NextResponse.next();
  }

  // Check admin password for protected routes
  const token = request.cookies.get('admin-token')?.value;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!token || token !== adminPassword) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/buyer-request-webhook|login|_next/static|_next/image|favicon.ico).*)'],
};`,

  'app/layout.tsx': `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lead Generation Platform',
  description: 'Autonomous lead generation & sales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">
        <nav className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">Lead Gen Platform</h1>
            <div className="space-x-4">
              <a href="/" className="hover:text-blue-400">Dashboard</a>
              <a href="/leads" className="hover:text-blue-400">Leads</a>
              <a href="/requests" className="hover:text-blue-400">Requests</a>
              <a href="/payments" className="hover:text-blue-400">Payments</a>
              <a href="/outreach" className="hover:text-blue-400">Outreach</a>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}`,

  'app/globals.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #444;
}

th {
  background: #1f2937;
  font-weight: 600;
}

tr:hover {
  background: #111827;
}

button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

button:hover {
  background: #2563eb;
}

input, textarea, select {
  padding: 0.5rem;
  background: #1f2937;
  color: white;
  border: 1px solid #374151;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.card {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 1rem 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}`,

  'app/page.tsx': `import { supabaseAdmin } from '@/lib/supabase';

export default async function Dashboard() {
  const { data: leads } = await supabaseAdmin.from('leads').select('*').limit(1);
  const { data: requests } = await supabaseAdmin.from('buyer_requests').select('*');
  const { data: payments } = await supabaseAdmin.from('payments').select('*');

  const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const totalLeads = leads?.[0]?.id || 0;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Dashboard</h1>

      <div className="grid">
        <div className="card">
          <h3 className="text-sm text-gray-400">Total Revenue</h3>
          <p className="text-3xl font-bold">\$${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400">Total Leads</h3>
          <p className="text-3xl font-bold">{totalLeads}</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400">Pending Requests</h3>
          <p className="text-3xl font-bold">{requests?.filter(r => r.status === 'pending').length || 0}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Recent Buyer Requests</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {requests?.slice(0, 5).map(r => (
              <tr key={r.id}>
                <td>{r.buyer_name}</td>
                <td>{r.category_wanted}</td>
                <td>{r.quantity_wanted}</td>
                <td>\$${r.price_offered}</td>
                <td>{r.status}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`,

  'app/login/page.tsx': `'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || password) {
      document.cookie = \`admin-token=\${password}; path=/; max-age=604800\`;
      router.push('/');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4"
        />
        <button type="submit" className="w-full">Login</button>
      </form>
    </div>
  );
}`,

  'app/api/buyer-request-webhook/route.ts': `import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const { error } = await supabaseAdmin
      .from('buyer_requests')
      .insert({
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email,
        buyer_phone: data.buyer_phone || null,
        category_wanted: data.category_wanted,
        quantity_wanted: parseInt(data.quantity_wanted) || null,
        price_offered: parseFloat(data.price_offered) || null,
        notes: data.notes || null,
      });

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed to save request' }, { status: 500 });
  }
}`,

  '.github/workflows/scrape.yml': \`name: Scrape Leads
on:
  schedule:
    - cron: '0 */2 * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run scrape
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}\`,

  '.github/workflows/sell-email.yml': \`name: Send Email Outreach
on:
  schedule:
    - cron: '0 */4 * * *'
  workflow_dispatch:

jobs:
  email:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run sell-email
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: \${{ secrets.RESEND_API_KEY }}
          DISCORD_WEBHOOK_URL: \${{ secrets.DISCORD_WEBHOOK_URL }}\`
};

Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
  console.log(`✓ Created ${filePath}`);
});

console.log('\\n✅ All files generated successfully!');
