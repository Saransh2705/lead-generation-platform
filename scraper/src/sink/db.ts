// DB access for the worker. Uses a direct Postgres connection (superuser via the
// pooler URL, provided as a secret) so it can call the service_role-only
// upsert_lead RPC. Local dev passes SUPABASE_DB_URL in the shell.
import pg from 'pg';
import type { UpsertPayload } from '../quality/types';

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error('SUPABASE_DB_URL not set');
    pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 4 });
  }
  return pool;
}
export async function closeDb() { if (pool) { await pool.end(); pool = null; } }

export async function upsertLead(p: UpsertPayload): Promise<{ lead_id: number; was_insert: boolean }> {
  const { rows } = await db().query('SELECT * FROM public.upsert_lead($1::jsonb)', [JSON.stringify(p)]);
  return rows[0];
}

export async function geoCacheGet(query: string): Promise<{ lat: number; lng: number } | null> {
  const { rows } = await db().query('SELECT lat, lng FROM public.geo_cache WHERE query = $1', [query]);
  if (!rows[0] || rows[0].lat == null) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
}
export async function geoCachePut(query: string, lat: number, lng: number) {
  await db().query(
    'INSERT INTO public.geo_cache(query,lat,lng,provider) VALUES($1,$2,$3,$4) ON CONFLICT (query) DO UPDATE SET lat=EXCLUDED.lat, lng=EXCLUDED.lng, fetched_at=now()',
    [query, lat, lng, 'nominatim']
  );
}

export async function updateSourceHealth(key: string, status: 'ok' | 'blocked' | 'empty' | 'error', yield_: number, error?: string | null) {
  await db().query(
    `UPDATE public.sources SET last_status=$2, last_run_at=now(), last_yield=$3, last_error=$4,
       last_success_at = CASE WHEN $2='ok' THEN now() ELSE last_success_at END,
       consecutive_failures = CASE WHEN $2='ok' THEN 0 ELSE consecutive_failures+1 END
     WHERE key=$1`,
    [key, status, yield_, error ?? null]
  );
}
