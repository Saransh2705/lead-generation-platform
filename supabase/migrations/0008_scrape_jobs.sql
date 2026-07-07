-- 0008: Canonical scrape job ledger (one row per dispatch BATCH) = lock + live
-- status + redacted log. Supersedes generation_runs for real scraping.
-- The partial unique index enforces "at most one running batch per runner_mode".

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  runner_mode TEXT NOT NULL DEFAULT 'cloud' CHECK (runner_mode IN ('cloud', 'home')),
  lock_key TEXT NOT NULL DEFAULT 'cloud',
  schedule_ids BIGINT[] NOT NULL DEFAULT '{}',
  trigger TEXT NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual', 'watchdog')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','dispatched','running','completed','failed','blocked','stuck','skipped_home_offline')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,      -- { items: [{category, source_key, geo}], ... }
  attempts INT NOT NULL DEFAULT 0,
  gh_run_id BIGINT,
  gh_run_url TEXT,
  found_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  blocked_count INT NOT NULL DEFAULT 0,
  source_stats JSONB NOT NULL DEFAULT '{}'::jsonb, -- per-source {found, inserted, blocked, last_status}
  error TEXT,
  error_class TEXT,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,          -- redacted run log (no PII/secrets)
  artifact_url TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overlap lock: only one dispatched/running batch per runner_mode at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_running_runner
  ON public.scrape_jobs(lock_key) WHERE status IN ('dispatched', 'running');
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON public.scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_heartbeat ON public.scrape_jobs(heartbeat_at) WHERE status IN ('dispatched', 'running');

-- Late FK from leads → jobs (all current leads.scrape_job_id are NULL, so valid).
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_scrape_job_fk;
ALTER TABLE public.leads ADD CONSTRAINT leads_scrape_job_fk
  FOREIGN KEY (scrape_job_id) REFERENCES public.scrape_jobs(id) ON DELETE SET NULL;

-- Retention: keep the ledger small for the 500MB free tier.
CREATE OR REPLACE FUNCTION public.prune_scrape_jobs(keep_days INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  DELETE FROM public.scrape_jobs
  WHERE status IN ('completed','failed','blocked','stuck','skipped_home_offline')
    AND created_at < now() - (keep_days || ' days')::interval;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- RLS: service_role full; anon read-only (dashboard reads /logs). Manual runs are
-- created by the Edge Function (service_role), so anon never writes here.
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.scrape_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_jobs" ON public.scrape_jobs FOR SELECT TO anon USING (true);

GRANT SELECT ON public.scrape_jobs TO anon;
GRANT ALL ON public.scrape_jobs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.scrape_jobs_id_seq TO service_role;
