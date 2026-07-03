-- Supabase-native scheduler: pg_cron invokes the run-schedules Edge Function
-- every minute (via pg_net), so schedules run unattended down to a 1-minute
-- interval — no GitHub Actions, no site open.
--
-- SECURITY: the real values for groq_api_key and cron_secret are NOT committed
-- (this repo is public). Set them out-of-band, e.g.:
--   INSERT INTO public.app_config (key, value) VALUES
--     ('groq_api_key', '<your-groq-key>'),
--     ('cron_secret',  '<a-random-secret>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Backend-only: no anon policies. The Edge Function reads it via service_role.
CREATE POLICY "service_role_all" ON public.app_config FOR ALL USING (auth.role() = 'service_role');

-- The Edge Function runs as service_role; ensure it can write the app tables.
GRANT ALL ON public.leads, public.buyer_requests, public.payments,
  public.generation_runs, public.categories, public.schedules,
  public.app_config, public.outreach_contacts, public.outreach_drafts
  TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Every minute: POST to the Edge Function with the shared cron secret header.
-- Replace <PROJECT_REF> and <CRON_SECRET> for your project.
SELECT cron.schedule(
  'lead-gen-run-schedules',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/run-schedules',
    body := '{}'::jsonb,
    headers := '{"Content-Type":"application/json","x-cron-key":"<CRON_SECRET>"}'::jsonb
  );
  $$
);
