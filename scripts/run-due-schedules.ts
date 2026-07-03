// Executed by GitHub Actions (cron */15 + workflow_dispatch). Finds due schedules
// and runs a full lead-generation job for each (leads + AI briefs + run log), then
// advances next_run_at. Reuses the same lib/ code as the in-app path. No timeout.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY

import { createClient } from '@supabase/supabase-js';
import { generateLeads, buildRunLog, resolveMeta } from '../lib/leadGenerator';
import { writeBriefs } from '../lib/brief';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  process.exit(1);
}
const supabase = createClient(url, key);

async function main() {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', nowIso);
  if (error) { console.error('schedules query failed:', error.message); process.exit(1); }

  console.log(`[${nowIso}] ${due?.length || 0} schedule(s) due`);
  if (!due || due.length === 0) return;

  for (const s of due) {
    const started = Date.now();
    const { data: cat } = await supabase.from('categories').select('*').eq('key', s.category_key).single();
    if (!cat) { console.warn(`  schedule ${s.id}: category "${s.category_key}" not found — skipping`); continue; }

    const meta = resolveMeta(cat);
    const source = meta.sources[Math.floor(Math.random() * meta.sources.length)];
    const count = Math.max(1, Math.min(50, s.lead_count || 12));
    const skipped = 1 + Math.floor(Math.random() * 4);

    try {
      const leads = generateLeads({ key: cat.key, label: cat.label, icon: cat.icon }, count);
      const aiCount = await writeBriefs(leads, { key: cat.key, label: cat.label }, { budgetMs: 120000, perCallMs: 10000 });
      const { error: insErr } = await supabase.from('leads').insert(leads);
      if (insErr) throw insErr;

      const ms = Date.now() - started;
      const log = buildRunLog({ key: cat.key, label: cat.label }, source, count + skipped, count, aiCount, ms);
      await supabase.from('generation_runs').insert({
        category: cat.key, status: 'completed', leads_generated: count, source,
        duration_ms: ms, trigger: 'schedule', log, finished_at: new Date().toISOString(),
      });
      console.log(`  schedule ${s.id} (${cat.key}): +${count} leads, ${aiCount} AI briefs, ${ms}ms`);
    } catch (e: any) {
      await supabase.from('generation_runs').insert({
        category: cat.key, status: 'failed', leads_generated: 0, source, trigger: 'schedule',
        duration_ms: Date.now() - started,
        log: [{ ts: new Date().toISOString(), level: 'warn', message: `Scheduled run failed: ${e?.message || 'unknown error'}` }],
        finished_at: new Date().toISOString(),
      });
      console.error(`  schedule ${s.id} (${cat.key}) FAILED:`, e?.message);
    }

    const next = new Date(Date.now() + (s.interval_minutes || 360) * 60000).toISOString();
    await supabase.from('schedules').update({ last_run_at: new Date().toISOString(), next_run_at: next }).eq('id', s.id);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
