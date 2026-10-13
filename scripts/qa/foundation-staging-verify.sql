-- Read-only verification after both foundation migrations. Run as the staging
-- migration administrator. Reports schema and ACLs, never survivor contents.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$
DECLARE history_table text; protected_column text;
BEGIN
  FOREACH history_table IN ARRAY ARRAY['incident_revisions', 'evidence_revisions'] LOOP
    IF to_regclass('public.' || history_table) IS NULL THEN
      RAISE EXCEPTION 'Missing foundation table: %', history_table;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || history_table)) THEN
      RAISE EXCEPTION 'RLS disabled: %', history_table;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || history_table, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || history_table, 'INSERT,UPDATE,DELETE')
      OR has_table_privilege('anon', 'public.' || history_table, 'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Unexpected history grants: %', history_table;
    END IF;
  END LOOP;
  FOREACH protected_column IN ARRAY ARRAY['status','client_user_id','attorney_user_id','link_id','response_outcome','submitted_at','completed_at'] LOOP
    IF has_column_privilege('authenticated', 'public.attorney_document_requests', protected_column, 'UPDATE') THEN
      RAISE EXCEPTION 'Direct request update permitted: %', protected_column;
    END IF;
  END LOOP;
  IF NOT has_column_privilege('authenticated', 'public.attorney_document_requests', 'response_note', 'UPDATE') THEN
    RAISE EXCEPTION 'Private draft updates unavailable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.respond_to_evidence_request(uuid,text,text,uuid[])', 'EXECUTE')
    OR has_function_privilege('anon', 'public.respond_to_evidence_request(uuid,text,text,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected response RPC grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.respond_to_evidence_request(uuid,text,text,uuid[])'::regprocedure
    AND prosecdef AND proconfig @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'Response RPC security configuration changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attorney_document_requests'
    AND policyname = 'Survivor reads own requests' AND permissive = 'RESTRICTIVE') THEN
    RAISE EXCEPTION 'Missing private request read restriction';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D' AND (
    (tgrelid = 'public.incidents'::regclass AND tgname = 'preserve_incident_revision')
    OR (tgrelid = 'public.evidence'::regclass AND tgname = 'preserve_evidence_revision')
    OR (tgname = 'serialize_record_disclosure' AND tgrelid IN (
      'public.attorney_client_links'::regclass, 'public.advocate_client_links'::regclass,
      'public.attorney_invitations'::regclass, 'public.advocate_invitations'::regclass,
      'public.attorney_access'::regclass)))) <> 7 THEN
    RAISE EXCEPTION 'Missing or disabled correction/disclosure trigger';
  END IF;
END $$;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('incident_revisions','evidence_revisions','attorney_document_requests')
ORDER BY tablename, policyname;
SELECT 'Foundation schema and permissions verification passed; fictional workflow and device QA still required' AS result;
ROLLBACK;
