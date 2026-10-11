revoke all privileges on all tables in schema public from anon;

grant insert on table public.feedback_submissions to anon;
grant insert on table public.org_access_requests to anon;
grant insert on table public.waitlist_signups to anon;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;