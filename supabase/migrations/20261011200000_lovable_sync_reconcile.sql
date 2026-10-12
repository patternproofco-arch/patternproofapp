-- Lovable sync reconcile (2026-10-11). Last migration in the merged history.
--
-- Sets one end state no matter which of main's (#207) and Lovable's migrations
-- already ran on the database, and in what order. Every statement is idempotent.
-- Needs Guardian CLEAR before anyone applies it. Not applied by this PR.
--
-- 1. attorney_client_links survivor guard = the reviewed #197 body, verbatim
--    (search_path '', server-side NEW.revoked_at := now(), revoke combined with
--    any other edit rejected).
-- 2. attorney_client_links: survivors keep only the column-level UPDATE grant
--    (clio_share_consent, clio_share_consent_at, status, revoked_at) behind one
--    UPDATE policy and the guard. No INSERT/DELETE/TRUNCATE for browser roles.
-- 3. consent_grants: writes are service_role only.
-- 4. private.has_attorney_access keeps #207's founder-approval check (Lovable's
--    re-run of honour_share_expiry would drop it). Skipped with a NOTICE when
--    #207 (private.attorney_is_approved) is not applied yet.
-- 5. anon: no table or sequence rights in public except INSERT on
--    feedback_submissions (public /org-feedback form). Default privileges for
--    postgres (and, best effort, supabase_admin) no longer hand anon anything.
-- 6. SECURITY DEFINER functions in public: EXECUTE revoked from anon and PUBLIC.
--    Roles that already had EXECUTE through PUBLIC (authenticated, service_role)
--    get it explicitly, so signed-in behaviour is unchanged. Keep-list for anon:
--    empty (no anon-reachable RPC; the only anon RLS policy uses auth.uid()).
--    New functions no longer default to EXECUTE for anon or PUBLIC.
-- 7. The 30-day entry draft purge cron job is removed outright.
-- 8. Lovable's new server-only tables have RLS on and no browser-role grants;
--    study tables keep owner-only policies.
-- 9. Storage policies for the private app buckets: TO authenticated instead of
--    PUBLIC (same expressions); message-exports UPDATE gets a WITH CHECK.

/* 1. Guard (#197, verbatim) ------------------------------------------------ */
CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  -- Columns a survivor may change for a Clio consent toggle.
  c_consent_keys constant text[] := ARRAY['clio_share_consent', 'clio_share_consent_at', 'updated_at'];
  -- Columns a survivor may change for a one-way revoke.
  c_revoke_keys constant text[] := ARRAY['status', 'revoked_at', 'updated_at'];
BEGIN
  -- service_role / server-side (no JWT subject), or not the survivor on this
  -- row: unchanged behaviour (RLS decides; attorneys have no UPDATE policy).
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- No-op update.
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- (ii) One-way revoke, nothing else.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    IF NEW.status = 'revoked'
       AND OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND (v_new - c_revoke_keys) = (v_old - c_revoke_keys)
    THEN
      -- Server time wins: never trust a client-supplied revoke timestamp.
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only a one-way revoke (status revoked + revoked_at set, nothing else) is allowed here'
      USING ERRCODE = '42501';
  END IF;

  -- (i) Clio consent fields only.
  IF (v_new - c_consent_keys) = (v_old - c_consent_keys) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS attorney_client_links_client_update_guard ON public.attorney_client_links;
CREATE TRIGGER attorney_client_links_client_update_guard
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();

/* 2. attorney_client_links browser writes ---------------------------------- */
DROP POLICY IF EXISTS "Clients manage clio share consent" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Clients revoke own links" ON public.attorney_client_links;
DROP POLICY IF EXISTS "Attorney accepts matching invitation" ON public.attorney_client_links;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.attorney_client_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.attorney_client_links FROM anon;
GRANT UPDATE (clio_share_consent, clio_share_consent_at, status, revoked_at) ON public.attorney_client_links TO authenticated;
GRANT ALL ON public.attorney_client_links TO service_role;
DROP POLICY IF EXISTS "Clients update consent or revoke own links" ON public.attorney_client_links;
CREATE POLICY "Clients update consent or revoke own links" ON public.attorney_client_links
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);

/* 3. consent_grants: service_role writes only ------------------------------- */
DROP POLICY IF EXISTS "Survivor updates own grants" ON public.consent_grants;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.consent_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.consent_grants FROM anon;
GRANT ALL ON public.consent_grants TO service_role;

/* 4. has_attorney_access keeps the approval check --------------------------- */
DO $do$
BEGIN
  IF to_regprocedure('private.attorney_is_approved(uuid)') IS NULL THEN
    RAISE NOTICE 'private.attorney_is_approved is missing: apply #207 (20261010150854_launch_consent_and_attorney_gate) first; has_attorney_access left unchanged';
    RETURN;
  END IF;
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
 SELECT private.attorney_is_approved(_attorney_id) AND EXISTS (
 SELECT 1 FROM public.attorney_client_links WHERE attorney_user_id = _attorney_id
 AND client_user_id = _client_id AND status = 'active' AND revoked_at IS NULL
 AND (expires_at IS NULL OR expires_at > now()));
$body$;
$fn$;
  REVOKE ALL ON FUNCTION private.has_attorney_access(uuid,uuid) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION private.has_attorney_access(uuid,uuid) TO authenticated, service_role;
END
$do$;

/* 5. anon: only the public feedback INSERT ---------------------------------- */
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
DO $do$
BEGIN
  IF to_regclass('public.feedback_submissions') IS NOT NULL THEN
    GRANT INSERT ON public.feedback_submissions TO anon;
  END IF;
END
$do$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
DO $do$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
  RAISE NOTICE 'supabase_admin default privileges not changed (%): run as supabase_admin or leave as Supabase default', SQLERRM;
END
$do$;

/* 6. SECURITY DEFINER functions in public: no anon / PUBLIC EXECUTE --------- */
DO $do$
DECLARE
  r record;
  -- SECURITY DEFINER functions anon must still call. Empty: the app makes no
  -- RPC before sign-in and the only anon policy (feedback_submissions INSERT)
  -- uses auth.uid() alone. Add a name here only with evidence.
  keep constant text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
      AND NOT (p.proname = ANY (keep))
  LOOP
    IF has_function_privilege('authenticated', r.sig, 'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END
$do$;
-- New functions created by postgres: no EXECUTE for PUBLIC anywhere, none for anon
-- in public; authenticated and service_role keep the access they get today.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
DO $do$
BEGIN
  IF to_regnamespace('private') IS NOT NULL THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
  END IF;
END
$do$;

/* 7. Entry draft purge job removed ----------------------------------------- */
DO $do$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-entry-drafts';
  END IF;
EXCEPTION WHEN undefined_function OR insufficient_privilege THEN
  RAISE NOTICE 'purge-old-entry-drafts not removed (%): remove it by hand', SQLERRM;
END
$do$;

/* 8. Lovable's new tables --------------------------------------------------- */
DO $do$
DECLARE
  t text;
  server_only constant text[] := ARRAY['user_webauthn_credentials', 'user_webauthn_challenges',
    'attorney_entry_reviews', 'attorney_applications'];
  owner_rw constant text[] := ARRAY['study_profiles', 'user_lesson_progress'];
BEGIN
  FOREACH t IN ARRAY server_only || owner_rw LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip missing table public.%', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    IF t = ANY (server_only) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    ELSE
      EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_select', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_insert', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_update', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_delete', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t || '_owner_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t || '_owner_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t || '_owner_update', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t || '_owner_delete', t);
    END IF;
  END LOOP;
END
$do$;

/* 9. Storage: app bucket policies apply to signed-in users only ------------- */
-- Same USING / WITH CHECK, role list changed from PUBLIC to authenticated
-- (ALTER POLICY keeps the expressions). message-exports UPDATE gains a WITH
-- CHECK equal to its USING, so a row cannot be moved out of the owner folder.
DO $do$
DECLARE
  p text;
  to_auth constant text[] := ARRAY['evidence read own', 'evidence insert own', 'evidence delete own',
    'voice read own', 'voice insert own', 'voice delete own',
    'own conv recordings read', 'own conv recordings write', 'own conv recordings delete'];
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage.objects missing: storage policies unchanged';
    RETURN;
  END IF;
  FOREACH p IN ARRAY to_auth LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p) THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated', p);
    ELSE
      RAISE NOTICE 'storage policy "%" not found: unchanged', p;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname = 'users update own message-exports') THEN
    ALTER POLICY "users update own message-exports" ON storage.objects TO authenticated
      USING (bucket_id = 'message-exports' AND (auth.uid())::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'message-exports' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'storage policies not changed (%): owned by the storage admin role; change them in the dashboard', SQLERRM;
END
$do$;
