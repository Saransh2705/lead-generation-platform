-- Custom categories + recurring schedules + lead enrichments (AI brief, website,
-- run trigger source). The `categories` table becomes the source of truth for
-- what can be generated; `schedules` drives the GitHub Actions heartbeat.

CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  description TEXT,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id BIGSERIAL PRIMARY KEY,
  category_key TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL DEFAULT 360,
  lead_count INTEGER NOT NULL DEFAULT 12,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.generation_runs ADD COLUMN IF NOT EXISTS trigger TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_schedules_due ON public.schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_categories_key ON public.categories(key);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.categories_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.schedules_id_seq TO anon;

CREATE POLICY "service_role_all" ON public.categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_categories" ON public.categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_categories" ON public.categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_categories" ON public.categories FOR DELETE TO anon USING (true);

CREATE POLICY "service_role_all" ON public.schedules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_schedules" ON public.schedules FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_schedules" ON public.schedules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_schedules" ON public.schedules FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_schedules" ON public.schedules FOR DELETE TO anon USING (true);

-- Seed the 5 built-in categories.
INSERT INTO public.categories (key, label, icon, description, is_builtin) VALUES
  ('real_estate_buyer', 'Real Estate Buyers', '🏠', 'People actively searching to buy property.', true),
  ('real_estate_seller', 'Real Estate Sellers', '🔑', 'Homeowners looking to list and sell.', true),
  ('mortgage', 'Mortgage Leads', '🏦', 'Prospects shopping for home loans & refinancing.', true),
  ('insurance', 'Insurance Leads', '🛡️', 'Consumers comparing insurance quotes.', true),
  ('b2b', 'B2B Contacts', '💼', 'Business decision-makers and company contacts.', true)
ON CONFLICT (key) DO NOTHING;
