-- Survivors: optional two-step sign-in (TOTP).
-- Accounts WITH a verified authenticator factor must present an aal2 JWT to
-- read or write their records over REST. Accounts without a verified factor
-- are unaffected (the restrictive policy is a no-op for them).
-- Order: apply after 20261011200000 (#214 sync) and 20261011210000 (#217).
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.current_user_has_verified_mfa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
     WHERE f.user_id = auth.uid()
       AND f.status::text = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_verified_mfa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_verified_mfa() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_verified_mfa() TO authenticated;

COMMENT ON FUNCTION public.current_user_has_verified_mfa() IS
  'True when auth.uid() has a verified MFA factor. Used by restrictive aal2 policies.';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'incidents', 'evidence', 'entry_drafts', 'evidence_incident_drafts',
    'voice_notes', 'communications', 'legal_documents', 'consent_grants'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip %: table not present', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Enrolled accounts require aal2" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Enrolled accounts require aal2" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (coalesce(auth.jwt() ->> ''aal'', '''') = ''aal2'' OR NOT (SELECT public.current_user_has_verified_mfa())) '
      || 'WITH CHECK (coalesce(auth.jwt() ->> ''aal'', '''') = ''aal2'' OR NOT (SELECT public.current_user_has_verified_mfa()))',
      t
    );
  END LOOP;
END $$;
