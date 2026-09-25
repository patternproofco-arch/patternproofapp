DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.waitlist_signups FROM anon, authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;