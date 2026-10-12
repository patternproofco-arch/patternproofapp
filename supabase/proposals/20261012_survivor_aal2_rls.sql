-- RUN ON muy (muynotmkcmehxnkhffzl) ONLY — require aal2 for MFA-enrolled users
-- PROPOSAL ONLY. Not in supabase/migrations or drizzle; nothing applies this
-- automatically. Needs Guardian CLEAR before anyone pastes it.
--
-- Why: survivor tables use permissive "own rows" policies (auth.uid() = user_id)
-- with no assurance check, so an account that turned on two-step sign-in can
-- still read/write its records over REST with a password-only (aal1) token.
-- This adds RESTRICTIVE policies: a session passes when its JWT aal = 'aal2',
-- OR the account has no verified MFA factor (two-step stays optional).
-- Accounts without two-step are unaffected. service_role bypasses RLS as before.
-- Idempotent: safe to re-run. Order: after #214 (20261011200000) and #217.

BEGIN;

CREATE OR REPLACE FUNCTION public.pp_mfa_session_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = auth.uid()
           AND f.status::text = 'verified'
      );
$$;

REVOKE ALL ON FUNCTION public.pp_mfa_session_ok() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pp_mfa_session_ok() FROM anon;
GRANT EXECUTE ON FUNCTION public.pp_mfa_session_ok() TO authenticated;

COMMENT ON FUNCTION public.pp_mfa_session_ok() IS
  'True when the session is aal2 or auth.uid() has no verified MFA factor. Used by restrictive aal2 policies.';

-- Survivor record tables (skipped with a NOTICE if a table is not present).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'incidents', 'evidence', 'entry_drafts', 'evidence_incident_drafts',
    'voice_notes', 'communications', 'legal_documents'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip %: table not present', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "pp enrolled accounts require aal2" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "pp enrolled accounts require aal2" ON public.%I AS RESTRICTIVE '
      || 'FOR ALL TO authenticated USING ((SELECT public.pp_mfa_session_ok())) '
      || 'WITH CHECK ((SELECT public.pp_mfa_session_ok()))',
      t
    );
  END LOOP;
END $$;

-- Storage: evidence files, voice notes and conversation recordings (private buckets).
DROP POLICY IF EXISTS "pp enrolled accounts require aal2 (files)" ON storage.objects;
CREATE POLICY "pp enrolled accounts require aal2 (files)" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('evidence-files', 'voice-notes', 'conversation-recordings') OR (SELECT public.pp_mfa_session_ok()))
  WITH CHECK (bucket_id NOT IN ('evidence-files', 'voice-notes', 'conversation-recordings') OR (SELECT public.pp_mfa_session_ok()));

COMMIT;

-- Read-out (run after; expect one row per present table + 1 storage row):
-- SELECT schemaname, tablename, policyname, permissive FROM pg_policies
--  WHERE policyname LIKE 'pp enrolled accounts require aal2%' ORDER BY 1,2;
