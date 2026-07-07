import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Manual "Run now": create a one-off, immediate, scraped schedule for a category.
// The every-minute orchestrator (pg_cron) claims it, dispatches to GitHub Actions,
// and disables it after one run. Anon can INSERT schedules, so no service-role needed.
export async function POST(req: NextRequest) {
  let category = '';
  try { category = (await req.json())?.category || ''; } catch {}
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });

  const { data: cat } = await supabaseAdmin.from('categories').select('lead_count,lat,lng').eq('key', category).maybeSingle();
  if (!cat) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  if (cat.lat == null || cat.lng == null) return NextResponse.json({ error: 'category has no location — edit it and set a city' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('schedules').insert({
    category_key: category,
    interval_minutes: 999999,
    lead_count: cat.lead_count || 12,
    enabled: true,
    next_run_at: new Date().toISOString(),
    mode: 'scraped',
    one_off: true,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedule_id: data.id });
}
