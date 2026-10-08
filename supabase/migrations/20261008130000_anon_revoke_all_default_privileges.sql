-- Guardian real-data gate (defense in depth): the anon role (signed-out
-- browser + publishable key) gets NOTHING in schema public except the one
-- grant the app needs, and new tables/sequences no longer hand anon access.
--
-- Inventory (src/lib/anon-access-inventory.ts, tested in
-- src/__tests__/anon-access-inventory.test.ts):
--   needed : INSERT on public.feedback_submissions (public /org-feedback form;
--            RLS allows only audience = 'org' AND user_id IS NULL; insert
--            without RETURNING, uuid PK, so no SELECT / sequence needed)
--   not needed by anon (service-role server functions or signed-in only):
--            org_access_requests, marketing_leads, waitlist_signups,
--            support_requests, incidents, evidence, notifications, ...
--   This drops the older anon INSERT grants on org_access_requests and
--   marketing_leads (20260915004705 / 20260920153000): no anon caller remains.
--
-- Supersedes drizzle 0007 (six-table revoke). Ordering: runs after
-- 20261008120000 / drizzle 0008 (PR #197); the two are independent.
--
-- Not changed: authenticated and service_role grants, RLS policies, schema
-- USAGE, function EXECUTE (public.has_role / has_attorney_access /
-- has_active_subscription, the old anon EXECUTE grants, were dropped in
-- 20260624221744; anything else anon can execute is listed by the
-- verification query for review, not revoked blind).
--
-- Default privileges: always for role postgres (owner of migration-created
-- tables). Also for every other role that owns objects in public, and for
-- supabase_admin, when the running role is allowed to; otherwise a NOTICE
-- says which role was skipped (hosted Supabase does not let postgres alter
-- supabase_admin's defaults).
--
-- Idempotent. Soft claim only: Grace pastes on muy after Guardian CLEAR.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- The only anon grant (see inventory).
GRANT INSERT ON TABLE public.feedback_submissions TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

DO $$
DECLARE
  r name;
BEGIN
  FOR r IN
    SELECT DISTINCT pg_get_userbyid(c.relowner)
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    UNION
    SELECT rolname FROM pg_roles WHERE rolname = 'supabase_admin'
  LOOP
    CONTINUE WHEN r = 'postgres';
    BEGIN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon', r);
      RAISE NOTICE 'default privileges: revoked anon tables/sequences for role %', r;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'default privileges: SKIPPED role % (running role % may not alter its defaults)', r, current_user;
    END;
  END LOOP;
END $$;
