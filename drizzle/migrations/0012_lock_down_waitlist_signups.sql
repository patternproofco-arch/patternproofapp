DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;
REVOKE ALL ON TABLE public.waitlist_signups FROM anon;
REVOKE ALL ON TABLE public.waitlist_signups FROM authenticated;
GRANT SELECT ON TABLE public.waitlist_signups TO authenticated;
GRANT ALL ON TABLE public.waitlist_signups TO service_role;