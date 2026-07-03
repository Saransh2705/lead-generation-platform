-- Run history for lead-generation jobs (powers the Run Logs page). Each row
-- stores a step-by-step log (jsonb) plus summary fields.

CREATE TABLE IF NOT EXISTS public.generation_runs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  leads_generated INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  duration_ms INTEGER,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_created ON public.generation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_runs_category ON public.generation_runs(category);

ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.generation_runs TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.generation_runs_id_seq TO anon;

CREATE POLICY "service_role_all" ON public.generation_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_runs" ON public.generation_runs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_runs" ON public.generation_runs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_runs" ON public.generation_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);
