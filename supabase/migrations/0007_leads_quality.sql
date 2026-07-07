-- 0007: Real-scraping quality/dedup/rollout columns on `leads`.
-- Additive + idempotent. Defaults chosen so EVERY existing insert path keeps
-- working and any not-yet-migrated writer is labeled 'sample' (never mislabeled
-- as real). Real scraper writes set mode/confidence/entity_key explicitly.

-- ---- Rollout tag ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'sample'
  CHECK (mode IN ('scraped', 'sample'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS scrape_env TEXT
  CHECK (scrape_env IS NULL OR scrape_env IN ('cloud', 'home', 'manual'));

-- ---- Provenance ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sources TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS scrape_job_id BIGINT;

-- ---- Normalized fields (drive dedup) ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name_norm TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_norm TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_domain TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website_domain TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city_norm TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS geocell TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone_line_type TEXT;

-- ---- Dedup ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS entity_key TEXT;               -- nullable; UNIQUE treats NULLs as distinct
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS dedup_count SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS possible_dupe BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS name_source_trust NUMERIC NOT NULL DEFAULT 0.4;

-- ---- Email signals ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_status TEXT
  CHECK (email_status IS NULL OR email_status IN ('unverified','invalid_syntax','no_mx','disposable','role','ok','unknown'));
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS mx_found BOOLEAN;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_disposable BOOLEAN;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_role_account BOOLEAN;

-- ---- Phone signals ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone_status TEXT
  CHECK (phone_status IS NULL OR phone_status IN ('unverified','invalid','valid'));

-- ---- Confidence / quality ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS confidence SMALLINT NOT NULL DEFAULT 0
  CHECK (confidence BETWEEN 0 AND 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_spam_risk BOOLEAN NOT NULL DEFAULT false;

-- ---- Lifecycle ----
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;

-- ---- Backfill existing rows (all current rows are fake/sample) ----
UPDATE public.leads SET first_seen_at = created_at WHERE first_seen_at IS NULL;
UPDATE public.leads SET entity_key = 'legacy:' || id WHERE entity_key IS NULL;

-- ---- Indexes ----
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_entity_key ON public.leads(entity_key);  -- NULLs distinct → sample rows unaffected
CREATE INDEX IF NOT EXISTS idx_leads_mode ON public.leads(mode);
CREATE INDEX IF NOT EXISTS idx_leads_source_key ON public.leads(source_key);
CREATE INDEX IF NOT EXISTS idx_leads_confidence ON public.leads(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email_status ON public.leads(email_status);
CREATE INDEX IF NOT EXISTS idx_leads_cat_geo ON public.leads(category, city_norm, geocell);
CREATE INDEX IF NOT EXISTS idx_leads_phone_e164 ON public.leads(phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_website_domain ON public.leads(website_domain);

-- ---- Freshness decay (applied at READ via the view) ----
-- Full confidence when unverified/just verified; decays to a 0.4 floor over ~1yr.
CREATE OR REPLACE FUNCTION public.lead_freshness(ts TIMESTAMPTZ)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN ts IS NULL THEN 1.0
    ELSE GREATEST(0.4, 1.0 - LEAST(1.0, (EXTRACT(EPOCH FROM (now() - ts)) / 86400.0) / 365.0) * 0.6)
  END;
$$;

-- Dashboard reads/filters `v_leads` so decay is continuous (no batch job).
CREATE OR REPLACE VIEW public.v_leads WITH (security_invoker = true) AS
  SELECT l.*, ROUND(l.confidence * public.lead_freshness(l.verified_at))::int AS confidence_effective
  FROM public.leads l;

GRANT SELECT ON public.v_leads TO anon, authenticated, service_role;
