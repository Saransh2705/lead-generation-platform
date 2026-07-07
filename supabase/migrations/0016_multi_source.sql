-- 0016: Multiple sources per category + enable the best-effort sources. Each
-- (category × source) becomes its own work-item, so one blocked source never
-- stops the others (per-source isolation happens in the worker loop).

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS source_keys TEXT[] NOT NULL DEFAULT '{osm_overpass}';
UPDATE public.categories SET source_keys = ARRAY[COALESCE(source_key,'osm_overpass')]
  WHERE (source_keys IS NULL OR source_keys = '{osm_overpass}') AND source_key IS NOT NULL;

-- Add Yelp; enable Yelp/YellowPages/Google Maps as cloud best-effort (honest block-detect).
INSERT INTO public.sources (key,label,icon,kind,enabled,cloud_safe,requires_home_ip,login_required,is_seed,emits_email,category_keys,min_delay_ms,max_delay_ms,max_per_minute,max_per_run,base_url,notes) VALUES
  ('yelp','Yelp','⭐','directory', true, true, false, false, true, false, ARRAY[]::text[], 3000, 7000, 3, 40, 'https://www.yelp.com','Anti-bot (DataDome/PerimeterX) — often blocks datacenter IPs. Best-effort; honest block-detect.')
ON CONFLICT (key) DO NOTHING;

UPDATE public.sources SET enabled = true, cloud_safe = true, requires_home_ip = false, login_required = false,
  notes = 'Search-results scrape (name/phone/website). Anti-bot may block datacenter IPs — best-effort, honest status.'
  WHERE key = 'yellowpages';
UPDATE public.sources SET enabled = true, cloud_safe = true, requires_home_ip = false, login_required = false,
  notes = 'Public Maps search via aria-labels (NO login, to protect the account). Blocks datacenter IPs hardest — best-effort.'
  WHERE key = 'google_maps';

-- claim_and_enqueue: expand each category into one work-item PER selected source.
CREATE OR REPLACE FUNCTION public.claim_and_enqueue(p_limit INT DEFAULT 20)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; c RECORD; sk TEXT; items JSONB := '[]'::jsonb; sids BIGINT[] := '{}'; job_id BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM public.schedules
    WHERE enabled = true AND mode = 'scraped' AND next_run_at <= now()
    ORDER BY next_run_at ASC LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    IF r.one_off THEN
      UPDATE public.schedules SET enabled = false, last_run_at = now() WHERE id = r.id;
    ELSE
      UPDATE public.schedules SET last_run_at = now(), next_run_at = now() + (COALESCE(r.interval_minutes,360) || ' minutes')::interval WHERE id = r.id;
    END IF;

    SELECT * INTO c FROM public.categories WHERE key = r.category_key;
    IF c.key IS NULL OR c.lat IS NULL OR c.lng IS NULL THEN CONTINUE; END IF;

    sids := sids || r.id;
    FOREACH sk IN ARRAY COALESCE(c.source_keys, ARRAY['osm_overpass']) LOOP
      IF EXISTS (SELECT 1 FROM public.sources WHERE key = sk AND enabled = true AND cloud_safe = true AND requires_home_ip = false AND kind <> 'sample' AND kind <> 'enrich') THEN
        items := items || jsonb_build_object(
          'schedule_id', r.id, 'category', c.key, 'source_key', sk,
          'geo', c.geo, 'lat', c.lat, 'lng', c.lng, 'search_terms', c.search_terms, 'osm_filter', c.osm_filter,
          'country', c.country, 'state', c.state, 'city', c.city,
          'radius_m', COALESCE(c.radius_m,6000), 'count', COALESCE(r.lead_count, c.lead_count, 12));
      END IF;
    END LOOP;
  END LOOP;

  IF jsonb_array_length(items) = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.scrape_jobs (runner_mode, lock_key, schedule_ids, trigger, status, payload)
  VALUES ('cloud','cloud', sids, 'schedule', 'queued', jsonb_build_object('items', items)) RETURNING id INTO job_id;
  RETURN job_id;
END;
$$;
