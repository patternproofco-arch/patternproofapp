-- 0a. Every public SECURITY DEFINER function and its EXECUTE ACL (NULL proacl = owner + PUBLIC)
SELECT p.oid::regprocedure AS fn, p.proacl, pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY 1::text;

-- 0b. Table ACLs of attorney_client_links and consent_grants
SELECT c.oid::regclass AS tbl, c.relacl, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
WHERE c.oid IN (to_regclass('public.attorney_client_links'), to_regclass('public.consent_grants'))
ORDER BY 1::text;

-- 0c. Column-level ACLs on those two tables (only columns that have one)
SELECT a.attrelid::regclass AS tbl, a.attname AS col, a.attacl
FROM pg_attribute a
WHERE a.attrelid IN (to_regclass('public.attorney_client_links'), to_regclass('public.consent_grants'))
  AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
ORDER BY 1::text, 2;
