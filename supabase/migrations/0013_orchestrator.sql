-- 0013: Move scrape orchestration fully into Postgres (pg_cron + pg_net), so no
-- Edge Function redeploy is needed. Every minute: reap stuck jobs, claim due
-- scraped schedules into a queued batch, and (if no batch is active) POST a
-- repository_dispatch to GitHub Actions. Re-tries next minute if a dispatch fails.

CREATE OR REPLACE FUNCTION public.orchestrate_scrapes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active INT; v_token TEXT; v_repo TEXT; q_id BIGINT;
BEGIN
  PERFORM public.reap_stuck_jobs(25);
  PERFORM public.claim_and_enqueue(20);  -- creates a queued batch iff schedules are due

  SELECT count(*) INTO v_active FROM public.scrape_jobs WHERE lock_key='cloud' AND status IN ('dispatched','running');
  IF v_active > 0 THEN RETURN; END IF;  -- one cloud batch at a time

  SELECT id INTO q_id FROM public.scrape_jobs WHERE status='queued' AND runner_mode='cloud' ORDER BY id ASC LIMIT 1;
  IF q_id IS NULL THEN RETURN; END IF;

  SELECT value INTO v_token FROM public.app_config WHERE key='github_dispatch_token';
  SELECT value INTO v_repo  FROM public.app_config WHERE key='github_repo';
  IF v_token IS NULL OR v_token = '' OR v_repo IS NULL THEN RETURN; END IF;  -- leave queued for a scheduled fallback / manual run

  PERFORM net.http_post(
    url := 'https://api.github.com/repos/' || v_repo || '/dispatches',
    body := jsonb_build_object('event_type','scrape','client_payload', jsonb_build_object('job_id', q_id)),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'User-Agent', 'leadgen-orchestrator'
    )
  );
  UPDATE public.scrape_jobs SET status='dispatched', dispatched_at=now(), updated_at=now() WHERE id=q_id;
END;
$$;

REVOKE ALL ON FUNCTION public.orchestrate_scrapes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orchestrate_scrapes() TO service_role;

-- Repoint the every-minute cron from the old (fake-generator) edge function to
-- the new in-DB orchestrator. The old edge function is left deployed but unused.
SELECT cron.unschedule('lead-gen-run-schedules') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='lead-gen-run-schedules');
SELECT cron.schedule('lead-gen-orchestrate', '* * * * *', 'SELECT public.orchestrate_scrapes();');
