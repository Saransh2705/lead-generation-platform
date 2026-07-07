-- 0010: Schedule source/geo/mode selection, anon-readable feature flags, and a
-- geocode cache (Nominatim results). Existing schedules default to mode='sample'
-- so they never silently start real scraping.

ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS source_key TEXT;         -- null = auto-pick enabled cloud_safe sources
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS geo TEXT;                 -- e.g. "Austin, TX"
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS lng NUMERIC;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'sample'
  CHECK (mode IN ('scraped', 'sample'));
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS allow_home BOOLEAN NOT NULL DEFAULT false;

-- Feature flags the UI reads live (app_config is service_role-only, so flags live here).
CREATE TABLE IF NOT EXISTS public.ui_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ui_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.ui_flags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_flags" ON public.ui_flags FOR SELECT TO anon USING (true);
GRANT SELECT ON public.ui_flags TO anon;
GRANT ALL ON public.ui_flags TO service_role;
INSERT INTO public.ui_flags (key, value) VALUES
  ('real_scraping_enabled', 'false'),   -- master switch, flipped on after Phase 4 verified
  ('default_leads_mode', 'all'),        -- 'all' until real data exists, then 'scraped'
  ('sample_generator_enabled', 'true')  -- keep the fake generator available as "Demo"
ON CONFLICT (key) DO NOTHING;

-- Geocode cache: one row per query string (Nominatim is rate-limited to 1 req/s).
CREATE TABLE IF NOT EXISTS public.geo_cache (
  query TEXT PRIMARY KEY,
  lat NUMERIC,
  lng NUMERIC,
  provider TEXT DEFAULT 'nominatim',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.geo_cache FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_geo" ON public.geo_cache FOR SELECT TO anon USING (true);
GRANT SELECT ON public.geo_cache TO anon;
GRANT ALL ON public.geo_cache TO service_role;
