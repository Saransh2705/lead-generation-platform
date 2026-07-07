import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Poll the status of a manual "Run" (by schedule id) or a job id.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const job = sp.get('job');
  const schedule = sp.get('schedule');
  const fields = 'id,status,found_count,inserted_count,updated_count,blocked_count,error,gh_run_url,trigger';

  if (job) {
    const { data } = await supabaseAdmin.from('scrape_jobs').select(fields).eq('id', job).maybeSingle();
    return NextResponse.json(data || { status: 'unknown' });
  }
  if (schedule) {
    const { data } = await supabaseAdmin
      .from('scrape_jobs').select(fields)
      .contains('schedule_ids', [Number(schedule)])
      .order('id', { ascending: false }).limit(1).maybeSingle();
    if (data) return NextResponse.json(data);
    // No job yet — still waiting for the orchestrator (runs every minute).
    const { data: sch } = await supabaseAdmin.from('schedules').select('enabled').eq('id', schedule).maybeSingle();
    return NextResponse.json({ status: sch ? 'pending' : 'unknown' });
  }
  return NextResponse.json({ status: 'unknown' });
}
