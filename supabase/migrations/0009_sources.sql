-- 0009: Source registry + per-source health. One row per scrape source.
-- Drives which sources run where (cloud vs home), pacing, and the Sources page.

CREATE TABLE IF NOT EXISTS public.sources (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '🌐',
  kind TEXT NOT NULL DEFAULT 'directory' CHECK (kind IN ('osm','directory','maps','enrich','sample')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  cloud_safe BOOLEAN NOT NULL DEFAULT true,
  requires_home_ip BOOLEAN NOT NULL DEFAULT false,
  login_required BOOLEAN NOT NULL DEFAULT false,
  is_seed BOOLEAN NOT NULL DEFAULT false,      -- true = discovers businesses; false = enrichment only
  emits_email BOOLEAN NOT NULL DEFAULT false,
  category_keys TEXT[] NOT NULL DEFAULT '{}',  -- empty = applies to any category
  min_delay_ms INT NOT NULL DEFAULT 2000,
  max_delay_ms INT NOT NULL DEFAULT 5000,
  max_per_minute INT NOT NULL DEFAULT 5,
  max_per_run INT NOT NULL DEFAULT 50,
  base_url TEXT,
  notes TEXT,
  -- health
  last_status TEXT CHECK (last_status IS NULL OR last_status IN ('ok','blocked','empty','error')),
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_yield INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.sources FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_sources" ON public.sources FOR SELECT TO anon USING (true);
GRANT SELECT ON public.sources TO anon;
GRANT ALL ON public.sources TO service_role;

-- Seeds. Only osm_overpass + website_enrich are enabled for the first slice;
-- yellowpages + google_maps are added disabled (turned on in Phase 6).
INSERT INTO public.sources (key,label,icon,kind,enabled,cloud_safe,requires_home_ip,login_required,is_seed,emits_email,category_keys,min_delay_ms,max_delay_ms,max_per_minute,max_per_run,base_url,notes) VALUES
  ('osm_overpass','OpenStreetMap','🗺️','osm', true, true,  false, false, true,  false, ARRAY['b2b'], 1500, 4000, 2, 60, 'https://overpass-api.de/api/interpreter','Coordinate-driven Overpass query; yields name/phone/website. Seed source; emails come from website_enrich.'),
  ('website_enrich','Website Enrichment','✉️','enrich', true, true, false, false, false, true, ARRAY[]::text[], 1500, 4000, 10, 200, NULL,'Visits each business website /contact /about to extract email + phone. Not a discovery source.'),
  ('yellowpages','Yellow Pages','📖','directory', false, true, false, false, true, false, ARRAY['b2b'], 3000, 7000, 3, 40, 'https://www.yellowpages.com','DataDome/PerimeterX risk from datacenter IPs → honest block-detect. Enable in Phase 6.'),
  ('google_maps','Google Maps','📍','maps', false, true, false, true, true, false, ARRAY['b2b'], 3000, 8000, 4, 40, 'https://www.google.com/maps','High yield but throttles datacenter IPs; logs in with ops gmail, best-effort, honest block-detect. Enable in Phase 6.'),
  ('sample_demo','Sample (Demo)','🧪','sample', true, true, false, false, true, true, ARRAY[]::text[], 0, 0, 0, 50, NULL,'The original fake generator, clearly labeled. Kept behind a feature flag.')
ON CONFLICT (key) DO NOTHING;
