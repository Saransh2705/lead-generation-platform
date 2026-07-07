-- 0015: Country → State → City targeting. Cascading dropdowns feed these from a
-- free offline dataset (country-state-city) with built-in coords, so no geocoding.

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_country ON public.leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_state ON public.leads(state);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);

-- claim_and_enqueue: include state/city in the work-item.
CREATE OR REPLACE FUNCTION public.claim_and_enqueue(p_limit INT DEFAULT 20)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; c RECORD; items JSONB := '[]'::jsonb; sids BIGINT[] := '{}'; job_id BIGINT;
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
    IF NOT EXISTS (
      SELECT 1 FROM public.sources
      WHERE key = COALESCE(c.source_key,'osm_overpass') AND enabled = true AND cloud_safe = true AND requires_home_ip = false AND kind <> 'sample'
    ) THEN CONTINUE; END IF;

    sids := sids || r.id;
    items := items || jsonb_build_object(
      'schedule_id', r.id, 'category', c.key, 'source_key', COALESCE(c.source_key,'osm_overpass'),
      'geo', c.geo, 'lat', c.lat, 'lng', c.lng, 'search_terms', c.search_terms, 'osm_filter', c.osm_filter,
      'country', c.country, 'state', c.state, 'city', c.city,
      'radius_m', COALESCE(c.radius_m,6000), 'count', COALESCE(r.lead_count, c.lead_count, 12));
  END LOOP;

  IF jsonb_array_length(items) = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.scrape_jobs (runner_mode, lock_key, schedule_ids, trigger, status, payload)
  VALUES ('cloud','cloud', sids, 'schedule', 'queued', jsonb_build_object('items', items)) RETURNING id INTO job_id;
  RETURN job_id;
END;
$$;

-- upsert_lead: write state/city (COALESCE-merge like country).
CREATE OR REPLACE FUNCTION public.upsert_lead(p JSONB)
RETURNS TABLE(lead_id BIGINT, was_insert BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT; v_ins BOOLEAN;
BEGIN
  INSERT INTO public.leads (
    category, name, email, phone, linkedin_url, socials, website, company, location, country, state, city,
    source, source_key, source_url, sources, source_urls, brief, status, mode, scrape_env, scrape_job_id,
    name_norm, email_norm, email_domain, website_domain, city_norm, geocell, phone_e164, phone_line_type,
    entity_key, name_source_trust, email_status, mx_found, is_disposable, is_role_account, phone_status,
    confidence, is_spam_risk, enriched_at, verified_at, first_seen_at, dedup_count
  ) VALUES (
    p->>'category', p->>'name', p->>'email', p->>'phone', p->>'linkedin_url',
    COALESCE(p->'socials', '{}'::jsonb),
    p->>'website', p->>'company', p->>'location', p->>'country', p->>'state', p->>'city',
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
    socials = excluded.socials || leads.socials,
    website = COALESCE(leads.website, excluded.website),
    website_domain = COALESCE(leads.website_domain, excluded.website_domain),
    company = COALESCE(leads.company, excluded.company),
    location = COALESCE(leads.location, excluded.location),
    country = COALESCE(leads.country, excluded.country),
    state = COALESCE(leads.state, excluded.state),
    city = COALESCE(leads.city, excluded.city),
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
