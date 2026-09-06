-- 1. SECURITY DEFINER trigger functions must never be callable from the API.
REVOKE ALL ON FUNCTION public.firm_members_seat_guard() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.normalize_legal_acceptance() FROM anon, authenticated, public;

-- 2. Remaining SECURITY DEFINER helpers are RLS/self-scoped helpers: no anon access.
REVOKE ALL ON FUNCTION public.firm_peer_user_ids() FROM anon, public;
REVOKE ALL ON FUNCTION public.org_peer_user_ids() FROM anon, public;
REVOKE ALL ON FUNCTION public.my_firm_id() FROM anon, public;
REVOKE ALL ON FUNCTION public.my_org_id() FROM anon, public;
REVOKE ALL ON FUNCTION public.list_my_oauth_consents() FROM anon, public;
REVOKE ALL ON FUNCTION public.revoke_my_oauth_consent(uuid) FROM anon, public;

-- 3. case_grants: server-managed only. Explicitly deny client roles.
REVOKE ALL ON TABLE public.case_grants FROM anon, authenticated;
ALTER TABLE public.case_grants ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.case_grants TO service_role;

-- 4. clio_connections holds OAuth tokens: anon had full table privileges.
REVOKE ALL ON TABLE public.clio_connections FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.clio_connections FROM authenticated;
GRANT SELECT, DELETE ON TABLE public.clio_connections TO authenticated;
GRANT ALL ON TABLE public.clio_connections TO service_role;

-- 5. waitlist_signups: submissions only, never readable/updatable by clients.
REVOKE ALL ON TABLE public.waitlist_signups FROM anon, authenticated;
GRANT INSERT ON TABLE public.waitlist_signups TO anon, authenticated;
GRANT SELECT ON TABLE public.waitlist_signups TO authenticated; -- admin-only SELECT policy still applies
GRANT ALL ON TABLE public.waitlist_signups TO service_role;

DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);