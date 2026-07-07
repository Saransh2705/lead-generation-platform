-- 0011: RPCs (race-safe upsert/merge, atomic claim+enqueue, manual enqueue,
-- stuck-job reaper) + app_config placeholders. All SECURITY DEFINER, granted to
-- service_role only. anon write-lock on `leads` is deferred to Phase 6.

-- Confidence can never exceed what the decomposed signals justify.
CREATE OR REPLACE FUNCTION public.signal_ceiling(p_email_status TEXT, p_mx_found BOOLEAN, p_phone_status TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(
    CASE p_email_status
      WHEN 'ok' THEN CASE WHEN p_mx_found IS TRUE THEN 90 ELSE 70 END
      WHEN 'role' THEN 65
      WHEN 'unknown' THEN 60
      WHEN 'unverified' THEN 55
      WHEN 'disposable' THEN 35
      WHEN 'no_mx' THEN 30
      WHEN 'invalid_syntax' THEN 20
      ELSE 50
    END,
    CASE p_phone_status WHEN 'valid' THEN 70 WHEN 'unverified' THEN 50 WHEN 'invalid' THEN 20 ELSE 40 END
  );
$$;

-- Insert-or-merge a scraped lead keyed by entity_key. Race-safe (ON CONFLICT).
-- Merges: fill-null contacts, union sources, dedup_count++, signal-clamped
-- confidence, authoritative spam risk, trust-compared name. Returns was_insert.
CREATE OR REPLACE FUNCTION public.upsert_lead(p JSONB)
RETURNS TABLE(lead_id BIGINT, was_insert BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT; v_ins BOOLEAN;
BEGIN
  INSERT INTO public.leads (
    category, name, email, phone, linkedin_url, website, company, location,
    source, source_key, source_url, sources, source_urls, brief, status, mode, scrape_env, scrape_job_id,
    name_norm, email_norm, email_domain, website_domain, city_norm, geocell, phone_e164, phone_line_type,
    entity_key, name_source_trust, email_status, mx_found, is_disposable, is_role_account, phone_status,
    confidence, is_spam_risk, enriched_at, verified_at, first_seen_at, dedup_count
  ) VALUES (
    p->>'category', p->>'name', p->>'email', p->>'phone', p->>'linkedin_url', p->>'website', p->>'company', p->>'location',
    COALESCE(p->>'source', p->>'source_key', 'scraped'), p->>'source_key', p->>'source_url',
    CASE WHEN p->>'source_key' IS NOT NULL THEN ARRAY[p->>'source_key'] ELSE '{}'::text[] END,
    CASE WHEN p->>'source_url' IS NOT NULL THEN jsonb_build_array(p->>'source_url') ELSE '[]'::jsonb END,
    p->>'brief', COALESCE(p->>'status','new'), COALESCE(p->>'mode','scraped'), p->>'scrape_env', (p->>'scrape_job_id')::bigint,
    p->>'name_norm', p->>'email_norm', p->>'email_domain', p->>'website_domain', p->>'city_norm', p->>'geocell', p->>'phone_e164', p->>'phone_line_type',
    p->>'entity_key', COALESCE((p->>'name_source_trust')::numeric, 0.4),
    p->>'email_status', (p->>'mx_found')::boolean, (p->>'is_disposable')::boolean, (p->>'is_role_account')::boolean, p->>'phone_status',
    LEAST(COALESCE((p->>'confidence')::int, 0), public.signal_ceiling(p->>'email_status', (p->>'mx_found')::boolean, p->>'phone_status')),
    COALESCE((p->>'is_spam_risk')::boolean, false), COALESCE((p->>'enriched_at')::timestamptz, now()), (p->>'verified_at')::timestamptz, now(), 1
  )
  ON CONFLICT (entity_key) DO UPDATE SET
    name = CASE WHEN excluded.name_source_trust > leads.name_source_trust THEN excluded.name ELSE leads.name END,
    name_source_trust = GREATEST(leads.name_source_trust, excluded.name_source_trust),
    email = COALESCE(leads.email, excluded.email),
    email_norm = COALESCE(leads.email_norm, excluded.email_norm),
    email_domain = COALESCE(leads.email_domain, excluded.email_domain),
    email_status = COALESCE(leads.email_status, excluded.email_status),
    mx_found = COALESCE(leads.mx_found, excluded.mx_found),
    is_disposable = COALESCE(leads.is_disposable, excluded.is_disposable),
    is_role_account = COALESCE(leads.is_role_account, excluded.is_role_account),
    phone = COALESCE(leads.phone, excluded.phone),
    phone_e164 = COALESCE(leads.phone_e164, excluded.phone_e164),
    phone_line_type = COALESCE(leads.phone_line_type, excluded.phone_line_type),
    phone_status = COALESCE(leads.phone_status, excluded.phone_status),
    linkedin_url = COALESCE(leads.linkedin_url, excluded.linkedin_url),
    website = COALESCE(leads.website, excluded.website),
    website_domain = COALESCE(leads.website_domain, excluded.website_domain),
    company = COALESCE(leads.company, excluded.company),
    location = COALESCE(leads.location, excluded.location),
    city_norm = COALESCE(leads.city_norm, excluded.city_norm),
    geocell = COALESCE(leads.geocell, excluded.geocell),
    brief = COALESCE(leads.brief, excluded.brief),
    sources = (SELECT ARRAY(SELECT DISTINCT unnest(leads.sources || excluded.sources))),
    source_urls = leads.source_urls || excluded.source_urls,
    dedup_count = leads.dedup_count + 1,
    is_spam_risk = leads.is_spam_risk OR excluded.is_spam_risk,
    confidence = LEAST(
      GREATEST(leads.confidence, excluded.confidence),
      public.signal_ceiling(COALESCE(leads.email_status, excluded.email_status), COALESCE(leads.mx_found, excluded.mx_found), COALESCE(leads.phone_status, excluded.phone_status))
    ),
    enriched_at = now(),
    verified_at = COALESCE(excluded.verified_at, leads.verified_at),
    updated_at = now()
  RETURNING id, (xmax = 0) INTO v_id, v_ins;
  lead_id := v_id; was_insert := v_ins; RETURN NEXT;
END;
$$;

-- Atomically claim due scraped schedules, advance next_run_at, and enqueue ONE
-- cloud batch of work-items — all in one tx (no silent gaps). Returns job id or NULL.
CREATE OR REPLACE FUNCTION public.claim_and_enqueue(p_limit INT DEFAULT 20)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; src RECORD; items JSONB := '[]'::jsonb; sids BIGINT[] := '{}'; job_id BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM public.schedules
    WHERE enabled = true AND mode = 'scraped' AND next_run_at <= now()
    ORDER BY next_run_at ASC LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.schedules
      SET last_run_at = now(),
          next_run_at = now() + (COALESCE(interval_minutes, 360) || ' minutes')::interval
      WHERE id = r.id;
    sids := sids || r.id;
    FOR src IN
      SELECT * FROM public.sources
      WHERE enabled = true AND cloud_safe = true AND requires_home_ip = false AND kind <> 'sample'
        AND (r.source_key IS NULL AND is_seed = true OR key = r.source_key)
        AND (category_keys = '{}' OR r.category_key = ANY(category_keys))
    LOOP
      items := items || jsonb_build_object('schedule_id', r.id, 'category', r.category_key, 'source_key', src.key, 'geo', r.geo, 'count', COALESCE(r.lead_count, 12));
    END LOOP;
  END LOOP;

  IF jsonb_array_length(items) = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.scrape_jobs (runner_mode, lock_key, schedule_ids, trigger, status, payload)
  VALUES ('cloud', 'cloud', sids, 'schedule', 'queued', jsonb_build_object('items', items))
  RETURNING id INTO job_id;
  RETURN job_id;
END;
$$;

-- Enqueue a manual (dashboard "Run") batch. Called by the Edge Function.
CREATE OR REPLACE FUNCTION public.enqueue_manual(p_category TEXT, p_source_key TEXT DEFAULT NULL, p_geo TEXT DEFAULT NULL, p_count INT DEFAULT 15)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src RECORD; items JSONB := '[]'::jsonb; job_id BIGINT;
BEGIN
  FOR src IN
    SELECT * FROM public.sources
    WHERE enabled = true AND cloud_safe = true AND requires_home_ip = false AND kind <> 'sample'
      AND (p_source_key IS NULL AND is_seed = true OR key = p_source_key)
      AND (category_keys = '{}' OR p_category = ANY(category_keys))
  LOOP
    items := items || jsonb_build_object('category', p_category, 'source_key', src.key, 'geo', p_geo, 'count', p_count);
  END LOOP;
  IF jsonb_array_length(items) = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.scrape_jobs (runner_mode, lock_key, trigger, status, payload)
  VALUES ('cloud', 'cloud', 'manual', 'queued', jsonb_build_object('items', items))
  RETURNING id INTO job_id;
  RETURN job_id;
END;
$$;

-- Free locks held by dead runs (stale heartbeat).
CREATE OR REPLACE FUNCTION public.reap_stuck_jobs(stale_min INT DEFAULT 25)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  UPDATE public.scrape_jobs
    SET status = 'stuck', error = COALESCE(error, 'heartbeat timeout'), finished_at = now(), updated_at = now()
  WHERE status IN ('dispatched', 'running')
    AND COALESCE(heartbeat_at, dispatched_at, created_at) < now() - (stale_min || ' minutes')::interval;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Execute grants: service_role only (Edge Function + worker use service_role).
REVOKE ALL ON FUNCTION public.upsert_lead(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_and_enqueue(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_manual(TEXT, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reap_stuck_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_lead(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_and_enqueue(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_manual(TEXT, TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_stuck_jobs(INT) TO service_role;

-- Config placeholders (non-secret). Real github_dispatch_token set out-of-band.
INSERT INTO public.app_config (key, value) VALUES
  ('github_repo', 'Saransh2705/lead-generation-platform'),
  ('github_workflow', 'scrape.yml'),
  ('github_dispatch_token', '')
ON CONFLICT (key) DO NOTHING;
