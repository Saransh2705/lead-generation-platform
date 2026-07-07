import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import CategoryManager from '@/app/components/CategoryManager';

export const dynamic = 'force-dynamic';

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function num(v: FormDataEntryValue | null): number | null { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : null; }
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function fields(fd: FormData) {
  const radius = parseInt(String(fd.get('radius_m') || '')) || 6000;
  return {
    label: String(fd.get('label') || '').trim(),
    icon: String(fd.get('icon') || '').trim() || '📋',
    search_terms: String(fd.get('search_terms') || '').trim() || null,
    osm_filter: String(fd.get('osm_filter') || '').trim() || null,
    geo: String(fd.get('geo') || '').trim() || null,
    country: String(fd.get('country') || '').trim() || null,
    state: String(fd.get('state') || '').trim() || null,
    city: String(fd.get('city') || '').trim() || null,
    lat: num(fd.get('lat')), lng: num(fd.get('lng')),
    radius_m: radius,
    lead_count: parseInt(String(fd.get('lead_count') || '12')) || 12,
  };
}

async function createCategory(formData: FormData) {
  'use server';
  const f = fields(formData);
  if (!f.label) return;
  const base = slugify(f.label) || 'category';
  const { data: existing } = await supabaseAdmin.from('categories').select('key').ilike('key', `${base}%`);
  const taken = new Set((existing || []).map((r: any) => r.key));
  let key = base, n = 2; while (taken.has(key)) key = `${base}_${n++}`;
  await supabaseAdmin.from('categories').insert({ key, is_builtin: false, ...f });
  revalidatePath('/generate'); revalidatePath('/schedules');
}
async function updateCategory(formData: FormData) {
  'use server';
  const key = String(formData.get('key') || ''); if (!key) return;
  await supabaseAdmin.from('categories').update(fields(formData)).eq('key', key);
  revalidatePath('/generate'); revalidatePath('/schedules');
}
async function deleteCategory(formData: FormData) {
  'use server';
  const key = String(formData.get('key') || ''); if (!key) return;
  await supabaseAdmin.from('categories').delete().eq('key', key);
  revalidatePath('/generate'); revalidatePath('/schedules');
}

export default async function GeneratePage() {
  const { data: categories } = await supabaseAdmin.from('categories').select('*').order('created_at', { ascending: false });
  const cats = categories || [];
  // Lead count + last-lead time per category (cheap client-side aggregate).
  let leadRows: any[] = [];
  try { leadRows = (await supabaseAdmin.from('leads').select('category,created_at').limit(5000)).data || []; } catch {}
  const agg: Record<string, { count: number; last: string }> = {};
  for (const l of leadRows) {
    const a = (agg[l.category] ||= { count: 0, last: l.created_at });
    a.count++; if (l.created_at > a.last) a.last = l.created_at;
  }
  const enriched = cats.map((c: any) => ({
    ...c,
    leadCount: agg[c.key]?.count || 0,
    lastRun: agg[c.key]?.last ? timeAgo(agg[c.key].last) : null,
  }));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Generate Leads</h1>
          <div className="sub">Create a category (business type + location), then Run a real cloud scrape</div>
        </div>
      </div>
      <div className="content">
        <CategoryManager categories={enriched} createAction={createCategory} updateAction={updateCategory} deleteAction={deleteCategory} />
      </div>
    </>
  );
}
