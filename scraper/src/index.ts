// GitHub Actions worker entry. Claims a scrape_jobs batch (by JOB_ID, or the
// oldest queued cloud batch), runs its work-items with heartbeats, self-aborts if
// reaped, and self-reports counts. One Chromium, source per item, shared session.
import { launchBrowser } from './browser';
import { scrapeItem, type WorkItem } from './pipeline';
import { attachBriefs } from './sink/briefs';
import { db, upsertLead, updateSourceHealth, closeDb } from './sink/db';

const JOB_ID = process.env.JOB_ID && process.env.JOB_ID.trim() ? Number(process.env.JOB_ID) : undefined;
const GH_RUN_ID = process.env.GITHUB_RUN_ID ? Number(process.env.GITHUB_RUN_ID) : null;
const GH_RUN_URL =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

let owns = true;

async function claimJob() {
  // Transition a queued/dispatched batch → running. The partial unique index
  // guarantees only one running cloud batch; a conflicting claim throws 23505.
  const sel = JOB_ID
    ? `SELECT $3::bigint AS id`
    : `SELECT id FROM public.scrape_jobs WHERE status='queued' AND runner_mode='cloud' ORDER BY id ASC LIMIT 1`;
  const q = `UPDATE public.scrape_jobs
       SET status='running', started_at=now(), heartbeat_at=now(), gh_run_id=$1, gh_run_url=$2, attempts=attempts+1, updated_at=now()
       WHERE id=(${sel}) AND status IN ('queued','dispatched') RETURNING *`;
  try {
    const params = JOB_ID ? [GH_RUN_ID, GH_RUN_URL, JOB_ID] : [GH_RUN_ID, GH_RUN_URL];
    const { rows } = await db().query(q, params);
    return rows[0] || null;
  } catch (e: any) {
    if (e.code === '23505') return null; // another running batch holds the lock
    throw e;
  }
}

async function heartbeat(id: number) {
  const res = await db().query(`UPDATE public.scrape_jobs SET heartbeat_at=now() WHERE id=$1 AND status='running'`, [id]);
  if (res.rowCount === 0) owns = false; // reaped by the watchdog
}

async function main() {
  const job = await claimJob();
  if (!job) { console.log('No claimable job (none queued, or a batch is already running).'); return; }
  const items: WorkItem[] = job.payload?.items || [];
  console.log(`Claimed job ${job.id} (${job.trigger}) with ${items.length} work-item(s).`);

  const hb = setInterval(() => heartbeat(job.id).catch(() => {}), 25000);
  const sourceStats: Record<string, any> = {};
  let found = 0, ins = 0, upd = 0, blocked = 0, lastError: string | null = null;

  const ctx = await launchBrowser();
  try {
    for (const item of items) {
      if (!owns) { console.log('Lost ownership (reaped) — aborting.'); break; }
      try {
        const r = await scrapeItem(ctx, item, 'cloud', job.id);
        found += r.found;
        const prev = sourceStats[r.source_key] || { found: 0, enriched: 0 };
        sourceStats[r.source_key] = { found: prev.found + r.found, enriched: prev.enriched + r.enriched, status: r.status, error: r.error };
        await updateSourceHealth(r.source_key, r.status, r.found, r.error).catch(() => {});
        if (r.status === 'blocked') blocked++;
        if (r.error) lastError = r.error;
        await attachBriefs(r.payloads, { key: item.category, label: item.category });
        for (const p of r.payloads) {
          try { const u = await upsertLead(p); u.was_insert ? ins++ : upd++; } catch (e: any) { console.log('upsert failed:', e.message); }
        }
        console.log(`  ${item.source_key} (${item.geo}): ${r.status}, found=${r.found}, enriched=${r.enriched}${r.error ? ' — ' + r.error : ''}`);
      } catch (e: any) {
        // Isolate: one source crashing must not stop the others.
        lastError = e?.message || 'source crashed';
        sourceStats[item.source_key] = { found: 0, enriched: 0, status: 'error', error: lastError };
        await updateSourceHealth(item.source_key, 'error', 0, lastError).catch(() => {});
        console.log(`  ${item.source_key} (${item.geo}): CRASHED — ${lastError}`);
      }
    }
  } finally {
    await ctx.close().catch(() => {});
    clearInterval(hb);
  }

  const status = !owns ? 'stuck' : found === 0 && blocked > 0 ? 'blocked' : 'completed';
  await db().query(
    `UPDATE public.scrape_jobs SET status=$2, found_count=$3, inserted_count=$4, updated_count=$5, blocked_count=$6,
       source_stats=$7::jsonb, error=$9, gh_run_url=COALESCE($8, gh_run_url), finished_at=now(), updated_at=now() WHERE id=$1`,
    [job.id, status, found, ins, upd, blocked, JSON.stringify(sourceStats), GH_RUN_URL, ins === 0 ? lastError : null]
  );
  console.log(`Job ${job.id} ${status}: found=${found} inserted=${ins} merged=${upd} blocked=${blocked}`);
}

main()
  .catch(async (e) => {
    console.error('FATAL', e);
    if (JOB_ID) {
      try {
        await db().query(`UPDATE public.scrape_jobs SET status='failed', error=$2, finished_at=now(), updated_at=now() WHERE id=$1`, [JOB_ID, String(e?.message || e).slice(0, 500)]);
      } catch {}
    }
    process.exitCode = 1;
  })
  .finally(() => closeDb());
