import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client for browser (anon key)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Server-side client. Prefer the service-role key (bypasses RLS); if it isn't a
// valid key, fall back to the anon key, which works via the anon RLS policies.
// Force uncached reads: Next/Vercel caches fetch() (incl. supabase-js) durably,
// which made the dashboard show stale counts. no-store keeps every page live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input as any, { ...init, cache: 'no-store' });
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || supabaseKey, {
  auth: { persistSession: false },
  global: { fetch: noStoreFetch },
});

export type Lead = {
  id: number;
  category: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: 'new' | 'contacted' | 'sold' | 'invalid';
  created_at: string;
};

export type BuyerRequest = {
  id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  category_wanted: string;
  quantity_wanted: number | null;
  price_offered: number | null;
  status: 'pending' | 'accepted' | 'rejected' | 'fulfilled';
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: number;
  date: string;
  buyer_name: string;
  buyer_email: string;
  amount: number;
  category: string | null;
  quantity: number | null;
  notes: string | null;
};
