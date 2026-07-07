-- Postgres expands SELECT * in a view at CREATE time, so v_leads didn't expose the
-- newly-added leads.logo_url / description columns. Rebuild it so l.* re-expands.
DROP VIEW IF EXISTS public.v_leads;
CREATE VIEW public.v_leads WITH (security_invoker = true) AS
  SELECT l.*, ROUND(l.confidence * public.lead_freshness(l.verified_at))::int AS confidence_effective
  FROM public.leads l;
GRANT SELECT ON public.v_leads TO anon, authenticated, service_role;
