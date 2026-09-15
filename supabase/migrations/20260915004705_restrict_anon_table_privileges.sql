-- Public Data API access is opt in. RLS remains enabled as a second boundary.
-- Browser forms verified to need anonymous writes:
--   feedback_submissions, org_access_requests, waitlist_signups
--
-- Authenticated browser requests use the authenticated Postgres role and are
-- intentionally unaffected by this migration.

revoke all privileges on all tables in schema public from anon;

grant insert on table public.feedback_submissions to anon;
grant insert on table public.org_access_requests to anon;
grant insert on table public.waitlist_signups to anon;

-- Prevent newly created public tables from inheriting broad anonymous access.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
