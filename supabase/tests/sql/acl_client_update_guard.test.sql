-- Behavioural test for public.attorney_client_links_client_update_guard()
-- (migration 20261008120000_acl_client_update_guard_allowlist.sql, C7).
--
-- Plain SQL, self-asserting: any failed expectation RAISEs and aborts.
-- Runs inside one transaction and ROLLs BACK, so it leaves no rows behind.
-- Run ONLY against a local / disposable database that has the migrations
-- applied, e.g.:
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/sql/acl_client_update_guard.test.sql
-- or, without Postgres installed: node scripts/run-acl-guard-sql-test.mjs (PGlite).
-- Never run against a live project.
--
-- Runs as the connecting (owner) role, so RLS is not exercised here; this
-- isolates the trigger. auth.uid() is driven via request.jwt.claims exactly
-- as PostgREST does.

BEGIN;

CREATE FUNCTION pg_temp.as_user(_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  SELECT set_config('request.jwt.claim.sub', _uid::text, true);
$$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SELECT set_config('request.jwt.claim.sub', '', true);
$$;

-- Fresh link owned by the fixed test survivor, with a unique attorney.
CREATE FUNCTION pg_temp.mk_link(_status text DEFAULT 'active', _revoked boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM pg_temp.as_service();
  INSERT INTO public.attorney_client_links (
    attorney_user_id, client_user_id, status, revoked_at, expires_at,
    scope_incidents, scope_evidence, include_all_incidents, include_all_evidence
  ) VALUES (
    gen_random_uuid(), '00000000-0000-4000-8000-00000000c7c7', _status,
    CASE WHEN _revoked THEN now() - interval '1 day' END,
    now() + interval '7 days', '{}', '{}', false, false
  ) RETURNING id INTO v_id;
  PERFORM pg_temp.as_user('00000000-0000-4000-8000-00000000c7c7');
  RETURN v_id;
END $$;

CREATE FUNCTION pg_temp.expect_denied(_label text, _setsql text, _status text DEFAULT 'active', _revoked boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid := pg_temp.mk_link(_status, _revoked);
BEGIN
  BEGIN
    EXECUTE format('UPDATE public.attorney_client_links SET %s WHERE id = %L', _setsql, v_id);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'ok   - denied: %', _label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL - expected 42501 but update succeeded: %', _label;
END $$;

CREATE FUNCTION pg_temp.expect_allowed(_label text, _setsql text, _status text DEFAULT 'active', _revoked boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := pg_temp.mk_link(_status, _revoked);
  v_n int;
BEGIN
  EXECUTE format('UPDATE public.attorney_client_links SET %s WHERE id = %L', _setsql, v_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL - expected 1 row updated, got %: %', v_n, _label;
  END IF;
  RAISE NOTICE 'ok   - allowed: %', _label;
  RETURN v_id;
END $$;

DO $$
DECLARE v_id uuid; r record;
BEGIN
  -- ---------------- rejected: frozen columns (survivor JWT) ----------------
  PERFORM pg_temp.expect_denied('expires_at extended', $q$expires_at = now() + interval '365 days'$q$);
  PERFORM pg_temp.expect_denied('expires_at cleared', 'expires_at = NULL');
  PERFORM pg_temp.expect_denied('attorney_user_id swapped', 'attorney_user_id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('client_user_id changed', 'client_user_id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('scope_incidents widened', 'scope_incidents = ARRAY[gen_random_uuid()]');
  PERFORM pg_temp.expect_denied('scope_evidence widened', 'scope_evidence = ARRAY[gen_random_uuid()]');
  PERFORM pg_temp.expect_denied('include_all_incidents', 'include_all_incidents = true');
  PERFORM pg_temp.expect_denied('include_all_evidence', 'include_all_evidence = true');
  PERFORM pg_temp.expect_denied('include_patterns', 'include_patterns = NOT include_patterns');
  PERFORM pg_temp.expect_denied('include_voice_notes', 'include_voice_notes = true');
  PERFORM pg_temp.expect_denied('include_communications', 'include_communications = true');
  PERFORM pg_temp.expect_denied('include_legal_documents', 'include_legal_documents = true');
  PERFORM pg_temp.expect_denied('case_id', 'case_id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('org_id', 'org_id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('invitation_id', 'invitation_id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('deposition_prep_consent', 'deposition_prep_consent = true, deposition_prep_consent_at = now()');
  PERFORM pg_temp.expect_denied('attorney_case_notes', $q$attorney_case_notes = 'x'$q$);
  PERFORM pg_temp.expect_denied('id', 'id = gen_random_uuid()');
  PERFORM pg_temp.expect_denied('created_at', $q$created_at = now() - interval '1 year'$q$);
  PERFORM pg_temp.expect_denied('Clio consent combined with expires_at',
    $q$clio_share_consent = true, clio_share_consent_at = now(), expires_at = now() + interval '365 days'$q$);

  -- ---------------- rejected: status / revoked_at abuse ----------------
  PERFORM pg_temp.expect_denied('status revoked -> active (re-arm)', $q$status = 'active'$q$, 'revoked', true);
  PERFORM pg_temp.expect_denied('revoked_at -> NULL', 'revoked_at = NULL', 'revoked', true);
  PERFORM pg_temp.expect_denied('re-arm: status active + revoked_at NULL', $q$status = 'active', revoked_at = NULL$q$, 'revoked', true);
  PERFORM pg_temp.expect_denied('re-arm + expires_at', $q$status = 'active', revoked_at = NULL, expires_at = now() + interval '365 days'$q$, 'revoked', true);
  PERFORM pg_temp.expect_denied('revoked_at moved on already-revoked link', 'revoked_at = now()', 'revoked', true);
  PERFORM pg_temp.expect_denied('status -> paused', $q$status = 'paused'$q$);
  PERFORM pg_temp.expect_denied('status revoked without revoked_at', $q$status = 'revoked'$q$);
  PERFORM pg_temp.expect_denied('revoked_at set without status revoked', 'revoked_at = now()');
  PERFORM pg_temp.expect_denied('revoke with far-future revoked_at', $q$status = 'revoked', revoked_at = now() + interval '30 days'$q$);
  PERFORM pg_temp.expect_denied('revoke + expires_at', $q$status = 'revoked', revoked_at = now(), expires_at = now() + interval '365 days'$q$);
  PERFORM pg_temp.expect_denied('revoke + attorney_user_id swap', $q$status = 'revoked', revoked_at = now(), attorney_user_id = gen_random_uuid()$q$);
  PERFORM pg_temp.expect_denied('revoke + scope widen', $q$status = 'revoked', revoked_at = now(), scope_incidents = ARRAY[gen_random_uuid()]$q$);
  PERFORM pg_temp.expect_denied('revoke + Clio consent', $q$status = 'revoked', revoked_at = now(), clio_share_consent = true, clio_share_consent_at = now()$q$);

  -- ---------------- allowed (survivor JWT) ----------------
  v_id := pg_temp.expect_allowed('one-way revoke (status revoked + revoked_at now)', $q$status = 'revoked', revoked_at = now()$q$);
  SELECT status, revoked_at INTO r FROM public.attorney_client_links WHERE id = v_id;
  IF r.status <> 'revoked' OR r.revoked_at IS NULL THEN RAISE EXCEPTION 'FAIL - revoke not persisted'; END IF;
  PERFORM pg_temp.expect_allowed('revoke from paused', $q$status = 'revoked', revoked_at = now()$q$, 'paused', false);
  v_id := pg_temp.expect_allowed('Clio consent on', 'clio_share_consent = true, clio_share_consent_at = now()');
  SELECT clio_share_consent INTO r FROM public.attorney_client_links WHERE id = v_id;
  IF NOT r.clio_share_consent THEN RAISE EXCEPTION 'FAIL - consent not persisted'; END IF;
  PERFORM pg_temp.expect_allowed('Clio consent off', 'clio_share_consent = false, clio_share_consent_at = NULL');
  PERFORM pg_temp.expect_allowed('Clio consent on (revoked link)', 'clio_share_consent = true, clio_share_consent_at = now()', 'revoked', true);
  PERFORM pg_temp.expect_allowed('no-op update', 'status = status');

  -- ---------------- unchanged: service_role bypass ----------------
  v_id := pg_temp.mk_link('revoked', true);
  PERFORM pg_temp.as_service();
  UPDATE public.attorney_client_links
     SET status = 'active', revoked_at = NULL, expires_at = now() + interval '30 days',
         scope_incidents = ARRAY[gen_random_uuid()]
   WHERE id = v_id;
  RAISE NOTICE 'ok   - allowed: service_role (no auth.uid()) re-activates + rescopes (server functions)';

  -- ---------------- unchanged: non-client caller passes the trigger ----------------
  -- (RLS has no attorney UPDATE policy, so a real attorney JWT is still denied by RLS.)
  v_id := pg_temp.mk_link();
  PERFORM pg_temp.as_user((SELECT attorney_user_id FROM public.attorney_client_links WHERE id = v_id));
  UPDATE public.attorney_client_links SET attorney_case_notes = 'attorney note' WHERE id = v_id;
  RAISE NOTICE 'ok   - unchanged: trigger does not guard attorney_user_id callers (RLS still applies)';

  RAISE NOTICE 'ALL acl_client_update_guard CASES PASSED';
END $$;

ROLLBACK;
