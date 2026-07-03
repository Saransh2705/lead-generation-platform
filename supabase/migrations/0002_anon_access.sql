-- Grant the anon role the access the app needs on its 3 core tables, with RLS
-- policies. The app authenticates server-side with the anon key (the real
-- service_role secret is dashboard-only); anon is public, so this is scoped to
-- exactly what the dashboard uses. Swap in a service_role secret to harden.

GRANT SELECT, INSERT, UPDATE ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE ON public.buyer_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.payments TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.leads_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.buyer_requests_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.payments_id_seq TO anon;

CREATE POLICY "anon_read_leads" ON public.leads FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_leads" ON public.leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_leads" ON public.leads FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_requests" ON public.buyer_requests FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_requests" ON public.buyer_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_requests" ON public.buyer_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_payments" ON public.payments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_payments" ON public.payments FOR INSERT TO anon WITH CHECK (true);
