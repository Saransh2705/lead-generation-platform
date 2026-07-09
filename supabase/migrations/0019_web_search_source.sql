-- New discovery source: web_search (DuckDuckGo/Bing → business websites → enrich).
-- Datacenter-safe (plain fetch, no anti-bot), so it runs unattended in the cloud.
ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_kind_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_kind_check
  CHECK (kind = ANY (ARRAY['osm','directory','maps','enrich','sample','search']));

INSERT INTO public.sources(key,label,icon,kind,enabled,cloud_safe,requires_home_ip,login_required,is_seed,emits_email,min_delay_ms,max_delay_ms,notes)
VALUES ('web_search','Web Search','🔎','search',true,true,false,false,true,false,1500,4000,
  'DuckDuckGo/Bing search for the business type + place, harvests business websites, then enriches for email/phone/logo. Datacenter-safe (plain fetch, no anti-bot).')
ON CONFLICT (key) DO UPDATE SET enabled=true, kind='search', notes=EXCLUDED.notes;
