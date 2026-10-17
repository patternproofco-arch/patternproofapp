-- 2.0 EVERY object the merged code needs: expect present = true on every row.
--      Any false row: stop, do not publish, send the output to Builder.
WITH need(kind, sch, name, on_tbl, source) AS (VALUES
  ('table','public','attorney_access_applications','','#207 20261010150854'),
  ('table','public','founder_attorney_invites','','#207 20261010150854'),
  ('table','public','signup_alert_outbox','','#207 20261011175000'),
  ('table','public','attorney_applications','','Lovable 0028 / 20261011191000'),
  ('table','public','study_profiles','','Lovable 0025'),
  ('table','public','user_lesson_progress','','Lovable 0025'),
  ('table','public','user_webauthn_credentials','','Lovable 0019'),
  ('table','public','user_webauthn_challenges','','Lovable 0019'),
  ('table','public','attorney_entry_reviews','','Lovable 0021'),
  ('table','public','entry_drafts','','Lovable 0020'),
  ('table','public','consent_grants','','existing'),
  ('table','public','email_send_log','','existing (not in repo migrations)'),
  ('table','public','suppressed_emails','','existing (not in repo migrations)'),
  ('table','public','clio_document_exports','','existing (not in repo migrations)'),
  ('table','public','org_follow_ups','','existing (not in repo migrations)'),
  ('table','public','referral_engagements','','existing (not in repo migrations)'),
  ('index','public','attorney_client_links_current_pair','','#207 20261011173000'),
  ('function','private','attorney_is_approved','','#207 20261010150854'),
  ('function','private','has_attorney_access','','#207 20261010150854 (+ reconcile)'),
  ('function','private','prevent_grant_resurrection','','#207 20261010150854'),
  ('function','private','audit_grant_mutation','','#207 20261010150854'),
  ('function','private','enqueue_signup_alert','','#207 20261011175000'),
  ('function','public','attorney_client_links_client_update_guard','','#197/#207 20261008120000 (+ reconcile)'),
  ('function','public','set_my_clio_share_consent','','#207 20261010150854'),
  ('function','public','revoke_my_consent_grant','','#207 20261010150854'),
  ('function','public','review_attorney_application','','#207 20261010150854'),
  ('function','public','claim_founder_attorney_invite','','#207 20261010150854'),
  ('function','public','founder_recent_signups','','#207 20261010150854'),
  ('function','public','accept_attorney_share','','#207 20261011173000'),
  ('function','public','claim_signup_alert','','#207 20261011175000'),
  ('function','public','attorney_billing_state','','#207 20261011180000'),
  ('function','public','sync_attorney_billing_access','','#207 20261011180000'),
  ('function','public','record_audit_event','','existing'),
  ('trigger','','attorney_client_links_client_update_guard','public.attorney_client_links','#197/#207'),
  ('trigger','','prevent_attorney_grant_resurrection','public.attorney_client_links','#207'),
  ('trigger','','prevent_consent_grant_resurrection','public.consent_grants','#207'),
  ('trigger','','audit_attorney_grant_mutation','public.attorney_client_links','#207'),
  ('trigger','','audit_consent_grant_mutation','public.consent_grants','#207'),
  ('trigger','','enqueue_signup_alert','public.user_roles','#207'),
  ('table','public','_reconcile_secdef_acl_snapshot','','sync reconcile (undo record)'),
  ('policy','','Applicant reads own review','public.attorney_access_applications','#207'),
  ('policy','','Approved live attorney links only','public.attorney_client_links','#207'),
  ('policy','','Clients update consent or revoke own links','public.attorney_client_links','Lovable 0027 / reconcile')
)
SELECT kind, coalesce(nullif(sch,''), on_tbl) AS location, name, source,
  CASE kind
    WHEN 'table' THEN to_regclass(sch || '.' || name) IS NOT NULL
    WHEN 'index' THEN to_regclass(sch || '.' || name) IS NOT NULL
    WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                 WHERE n.nspname = sch AND p.proname = name)
    WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname = name AND NOT t.tgisinternal
                                AND t.tgrelid = to_regclass(on_tbl))
    WHEN 'policy' THEN EXISTS (SELECT 1 FROM pg_policies p WHERE p.policyname = name
                               AND (p.schemaname || '.' || p.tablename) = on_tbl)
  END AS present
FROM need ORDER BY present, kind, name;
-- Old one-pair constraint is gone (expect 0 rows):
SELECT conname FROM pg_constraint WHERE conname = 'attorney_client_links_attorney_user_id_client_user_id_key';
-- Attorneys who will need founder approval (#207 grandfathers no one). Ids only:
SELECT r.user_id, (a.status IS NOT NULL) AS has_application, a.status
FROM public.user_roles r LEFT JOIN public.attorney_access_applications a ON a.user_id = r.user_id
WHERE r.role = 'attorney' ORDER BY a.status NULLS FIRST;

-- 2a. Live guard definition (expect search_path="", NEW.revoked_at := now(), c_revoke_keys)
SELECT p.oid::regprocedure AS fn, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) AS def
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'attorney_client_links_client_update_guard';
SELECT tgname, tgenabled, tgrelid::regclass, tgfoid::regprocedure
FROM pg_trigger WHERE tgrelid = 'public.attorney_client_links'::regclass AND NOT tgisinternal;

-- 2b. has_attorney_access (expect private.attorney_is_approved in the body)
SELECT p.oid::regprocedure, pg_get_functiondef(p.oid) FROM pg_proc p
WHERE p.proname IN ('has_attorney_access', 'attorney_is_approved');

-- 2c. attorney_client_links + consent_grants: table ACLs, column grants, policies
SELECT c.oid::regclass AS tbl, c.relacl, c.relrowsecurity FROM pg_class c
WHERE c.oid IN ('public.attorney_client_links'::regclass, 'public.consent_grants'::regclass);
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('attorney_client_links', 'consent_grants')
ORDER BY 1, 2, 3;
SELECT table_name, column_name, grantee, privilege_type FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('attorney_client_links', 'consent_grants')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC') AND privilege_type <> 'SELECT'
ORDER BY 1, 3, 4, 2;
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('attorney_client_links', 'consent_grants')
ORDER BY 1, 2;

-- 2d. ANY anon right left in public: tables, columns, sequences, functions (expect only
--     feedback_submissions INSERT; functions: no SECURITY DEFINER rows)
SELECT 'table' AS kind, table_name AS obj, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
UNION ALL
SELECT 'column', table_name || '.' || column_name, privilege_type FROM information_schema.column_privileges
WHERE table_schema = 'public' AND grantee = 'anon' AND table_name <> 'feedback_submissions'
UNION ALL
SELECT 'sequence', c.relname, a.privilege_type
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
WHERE n.nspname = 'public' AND c.relkind = 'S' AND a.grantee = 'anon'::regrole
UNION ALL
SELECT 'function' || CASE WHEN p.prosecdef THEN ' (SECURITY DEFINER)' ELSE '' END, p.oid::regprocedure::text, 'EXECUTE'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1, 2;

-- 2e. Default ACLs that still grant anon or PUBLIC anything (all schemas, all owners)
SELECT pg_get_userbyid(d.defaclrole) AS owner, coalesce(n.nspname, '(all schemas)') AS schema,
  CASE d.defaclobjtype WHEN 'r' THEN 'tables' WHEN 'S' THEN 'sequences' WHEN 'f' THEN 'functions'
    WHEN 'T' THEN 'types' WHEN 'n' THEN 'schemas' END AS objects,
  CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee, a.privilege_type
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace, aclexplode(d.defaclacl) a
WHERE a.grantee = 0 OR a.grantee = 'anon'::regrole
ORDER BY 1, 2, 3, 5;
-- Note: with no pg_default_acl row for an owner, functions default to PUBLIC EXECUTE.
SELECT pg_get_userbyid(defaclrole) AS owner, defaclnamespace, defaclobjtype, defaclacl FROM pg_default_acl
WHERE defaclnamespace = 0;

-- 2f. SECURITY DEFINER functions in public with PUBLIC EXECUTE (expect 0 rows)
SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
WHERE n.nspname = 'public' AND p.prosecdef AND a.grantee = 0;

-- 2g. cron (expect no purge-old-entry-drafts row)
SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;

-- 2h. Lovable's new tables: RLS, grants, policies
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('user_webauthn_credentials', 'user_webauthn_challenges',
  'attorney_entry_reviews', 'attorney_applications', 'study_profiles', 'user_lesson_progress')
ORDER BY 1;
SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('user_webauthn_credentials', 'user_webauthn_challenges',
  'attorney_entry_reviews', 'attorney_applications', 'study_profiles', 'user_lesson_progress')
ORDER BY 1, 2;

-- 2i. Storage policies (expect every app-bucket policy TO {authenticated};
--     message-exports UPDATE with_check = qual)
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;

-- 2j. Policies anon can hit (TO anon or PUBLIC) in public, and the functions they call
SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
ORDER BY 1, 2;

-- 2k. Tables the app uses that no repo migration creates: RLS, policies, browser-role grants
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('email_send_log', 'suppressed_emails',
  'clio_document_exports', 'org_follow_ups', 'referral_engagements')
ORDER BY 1;
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('email_send_log', 'suppressed_emails',
  'clio_document_exports', 'org_follow_ups', 'referral_engagements')
ORDER BY 1, 2;
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND table_name IN ('email_send_log', 'suppressed_emails', 'clio_document_exports',
    'org_follow_ups', 'referral_engagements')
ORDER BY 1, 2, 3;

-- 2l. Undo record written by section 1 (server-only table)
SELECT fn, had_public, proacl, captured_at FROM public._reconcile_secdef_acl_snapshot ORDER BY fn;
SELECT c.relrowsecurity, c.relacl FROM pg_class c WHERE c.oid = 'public._reconcile_secdef_acl_snapshot'::regclass;

-- 2m. Roles that keep EXECUTE on public SECURITY DEFINER functions after section 1
SELECT p.oid::regprocedure AS fn, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND p.prosecdef
  AND r.rolname IN ('anon', 'authenticated', 'service_role', 'supabase_auth_admin',
    'supabase_storage_admin', 'authenticator')
ORDER BY 1::text, 2;
