-- Clio OAuth credentials must never be readable by a browser session, even
-- encrypted. Restrict authenticated column access to non-secret metadata;
-- the token columns stay service_role only.
REVOKE SELECT, INSERT, UPDATE ON public.clio_connections FROM authenticated;

GRANT SELECT (
  id, user_id, clio_user_id, clio_user_email, clio_user_name, firm_name,
  clio_region, expires_at, last_refresh_at, last_verified_at, revoked_at,
  created_at, updated_at
) ON public.clio_connections TO authenticated;

GRANT ALL ON public.clio_connections TO service_role;