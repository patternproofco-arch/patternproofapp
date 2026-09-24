-- Guardian-safe fail-closed: close public waitlist_signups writes.
-- Product no longer ships a /waitlist route; sitemap entry is removed in the
-- same change set. Public lead capture uses marketing_leads (server path).
--
-- Soft claim: reduces anonymous spam/write surface on waitlist_signups.
-- Does not claim absolute security. Needs Guardian CLEAR before apply.
--
-- Does NOT: rotate secrets, clear PINs, or touch production data in this PR.

-- Drop open INSERT policy flagged by Lovable security scan
-- ("Anyone can add any record to waitlist_signups").
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;

-- Fail closed: no browser roles may write waitlist_signups.
REVOKE ALL ON TABLE public.waitlist_signups FROM anon;
REVOKE ALL ON TABLE public.waitlist_signups FROM authenticated;

-- Admin read via existing RLS policy "Admins can read waitlist signups"
-- (private.has_role(..., 'admin')). Re-grant SELECT only to authenticated.
GRANT SELECT ON TABLE public.waitlist_signups TO authenticated;

-- Service role retains full access for ops/exports.
GRANT ALL ON TABLE public.waitlist_signups TO service_role;

-- Keep validation trigger in place for any future service_role inserts.
-- (public.waitlist_validate + waitlist_signups_validate unchanged.)
