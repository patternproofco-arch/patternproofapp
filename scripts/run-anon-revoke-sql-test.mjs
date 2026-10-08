#!/usr/bin/env node
/**
 * Local-only behavioural test of
 * supabase/migrations/20261008130000_anon_revoke_all_default_privileges.sql
 * on PGlite (in-process WASM Postgres). Never connects to any remote DB.
 *
 * PGlite is NOT a project dependency (no lockfile change):
 *   mkdir -p /tmp/pglite && (cd /tmp/pglite && npm i @electric-sql/pglite@0.3)
 *   PGLITE_MODULE=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
 *     node scripts/run-anon-revoke-sql-test.mjs
 *
 * Builds a representative Supabase-like schema (roles anon / authenticated /
 * service_role / supabase_admin + a second table owner, Supabase's default
 * "grant all to anon, authenticated, service_role" ACLs, the real intake
 * tables with their RLS policies, sensitive tables, a view, a sequence, and
 * the historical anon grants), applies the migration twice, then checks:
 *  - anon can still INSERT an org feedback row (and RLS still rejects others);
 *  - anon cannot SELECT / INSERT / UPDATE / DELETE anything else, nor use sequences;
 *  - tables created afterwards by postgres, by another owner, or by
 *    supabase_admin give anon nothing;
 *  - authenticated grants are byte-for-byte unchanged;
 *  - the default-privileges loop skips (NOTICE) instead of failing when the
 *    running role may not alter another owner's defaults.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = readFileSync(
  resolve(root, "supabase/migrations/20261008130000_anon_revoke_all_default_privileges.sql"),
  "utf8",
);
const modPath = process.env.PGLITE_MODULE ?? "@electric-sql/pglite";
const { PGlite } = await import(modPath.startsWith("/") ? pathToFileURL(modPath).href : modPath);

const SETUP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE ROLE supabase_admin NOLOGIN; CREATE ROLE lovable_owner NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT CREATE ON SCHEMA public TO supabase_admin, lovable_owner;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

-- Supabase-style default ACLs: every new table/sequence is open to the API roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE lovable_owner IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Real intake table + policies (20260723212437).
CREATE TABLE public.feedback_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audience text NOT NULL CHECK (audience IN ('survivor','attorney','org')),
  user_id uuid NULL, responses jsonb NOT NULL, user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can submit their own feedback" ON public.feedback_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Anonymous users can submit org feedback" ON public.feedback_submissions
  FOR INSERT TO anon WITH CHECK (audience = 'org' AND user_id IS NULL);

-- Former anon-intake tables, with anon INSERT policies that stay in place.
CREATE TABLE public.org_access_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_name text);
ALTER TABLE public.org_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_insert ON public.org_access_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TABLE public.marketing_leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_insert ON public.marketing_leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TABLE public.waitlist_signups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);

-- Sensitive tables; some WITHOUT RLS so grants alone must stop anon.
CREATE TABLE public.attorney_client_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_user_id uuid, status text);
ALTER TABLE public.attorney_client_links ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, body text);
CREATE TABLE public.evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, role text);
CREATE TABLE public.counters (id bigserial PRIMARY KEY, n int);
CREATE VIEW public.v_incident_counts AS SELECT user_id, count(*) FROM public.incidents GROUP BY user_id;
INSERT INTO public.incidents (user_id, body) VALUES (gen_random_uuid(), 'secret');
INSERT INTO public.counters (n) VALUES (1);

-- Historical explicit anon grants (20260915004705 / 20260920153000 / 20260906231706).
GRANT INSERT ON public.org_access_requests, public.marketing_leads, public.waitlist_signups TO anon;
GRANT SELECT (id, status) ON public.attorney_client_links TO anon;

-- A table owned by a different role (e.g. a Lovable / dashboard owner).
SET ROLE lovable_owner;
CREATE TABLE public.legacy_lovable (id int PRIMARY KEY, secret text);
INSERT INTO public.legacy_lovable VALUES (1, 'x');
RESET ROLE;
`;

const db = new PGlite();
const results = [];
const check = (label, pass, extra = "") => {
  results.push({ label, pass });
  console.log(`  ${pass ? "ok  " : "FAIL"} - ${label}${extra ? ` (${extra})` : ""}`);
};

async function asAnon(sql) {
  await db.exec("BEGIN; SET LOCAL ROLE anon;");
  try {
    await db.query(sql);
    await db.exec("COMMIT");
    return { ok: true };
  } catch (e) {
    await db.exec("ROLLBACK");
    return { ok: false, code: e.code, msg: e.message };
  }
}

const AUTH_GRANTS = `
  SELECT string_agg(format('%s %s %s', table_name, privilege_type, coalesce(column_name, '*')), E'\\n'
                    ORDER BY table_name, privilege_type, column_name) AS g
  FROM (
    SELECT table_name::text, privilege_type::text, NULL::text AS column_name
      FROM information_schema.role_table_grants WHERE grantee = 'authenticated' AND table_schema = 'public'
    UNION ALL
    SELECT table_name::text, privilege_type::text, column_name::text
      FROM information_schema.column_privileges WHERE grantee = 'authenticated' AND table_schema = 'public'
  ) x`;

await db.exec(SETUP);
const authBefore = (await db.query(AUTH_GRANTS)).rows[0].g;
const anonBefore = await asAnon("SELECT body FROM public.incidents");
console.log(
  `[setup] anon SELECT incidents before migration: ${anonBefore.ok ? "ALLOWED (as expected)" : "denied"}`,
);

const notices = [];
await db.exec(MIGRATION, { onNotice: (n) => notices.push(n.message) });
await db.exec(MIGRATION); // idempotent
for (const n of notices.filter((m) => m.startsWith("default privileges")))
  console.log(`  notice: ${n}`);

console.log("[after migration]");
// Allowed
const ins = await asAnon(
  `INSERT INTO public.feedback_submissions (audience, user_id, responses) VALUES ('org', NULL, '{"a":1}')`,
);
check("anon INSERT org feedback (the /org-feedback form)", ins.ok, ins.msg);
const rls = await asAnon(
  `INSERT INTO public.feedback_submissions (audience, user_id, responses) VALUES ('survivor', NULL, '{}')`,
);
check(
  "RLS intact: anon INSERT survivor feedback rejected",
  !rls.ok && rls.code === "42501",
  rls.code,
);
const ret = await asAnon(
  `INSERT INTO public.feedback_submissions (audience, user_id, responses) VALUES ('org', NULL, '{}') RETURNING id`,
);
check(
  "anon INSERT ... RETURNING denied (no SELECT; app inserts without .select())",
  !ret.ok && ret.code === "42501",
  ret.code,
);
for (const op of [
  "SELECT * FROM public.feedback_submissions",
  "UPDATE public.feedback_submissions SET user_agent = 'x'",
  "DELETE FROM public.feedback_submissions",
]) {
  const r = await asAnon(op);
  check(`anon denied: ${op}`, !r.ok && r.code === "42501", r.code);
}

// Everything else denied
const others = [
  "org_access_requests",
  "marketing_leads",
  "waitlist_signups",
  "attorney_client_links",
  "incidents",
  "evidence",
  "user_roles",
  "counters",
  "legacy_lovable",
];
for (const t of others) {
  for (const [op, sql] of [
    ["SELECT", `SELECT * FROM public.${t}`],
    ["INSERT", `INSERT INTO public.${t} DEFAULT VALUES`],
    ["UPDATE", `UPDATE public.${t} SET id = id`],
    ["DELETE", `DELETE FROM public.${t}`],
  ]) {
    const r = await asAnon(sql);
    check(`anon denied: ${op} ${t}`, !r.ok && r.code === "42501", r.code);
  }
}
const view = await asAnon("SELECT * FROM public.v_incident_counts");
check("anon denied: SELECT view v_incident_counts", !view.ok && view.code === "42501", view.code);
const seq = await asAnon("SELECT nextval('public.counters_id_seq')");
check("anon denied: nextval on a public sequence", !seq.ok && seq.code === "42501", seq.code);

const left = await db.query(`
  SELECT table_name, privilege_type FROM information_schema.role_table_grants
   WHERE grantee = 'anon' AND table_schema = 'public' ORDER BY 1, 2`);
check(
  "only remaining anon table grant is INSERT on feedback_submissions",
  JSON.stringify(left.rows) ===
    JSON.stringify([{ table_name: "feedback_submissions", privilege_type: "INSERT" }]),
  JSON.stringify(left.rows),
);
const colTables = await db.query(
  `SELECT DISTINCT table_name FROM information_schema.column_privileges WHERE grantee = 'anon' AND table_schema = 'public'`,
);
check(
  "column privileges for anon exist only on feedback_submissions (implied by its table INSERT)",
  colTables.rows.every((r) => r.table_name === "feedback_submissions"),
  JSON.stringify(colTables.rows),
);

// New tables after the migration
await db.exec(`CREATE TABLE public.new_by_postgres (id int);`);
await db.exec(`SET ROLE lovable_owner; CREATE TABLE public.new_by_lovable (id int); RESET ROLE;`);
await db.exec(
  `SET ROLE supabase_admin; CREATE TABLE public.new_by_supabase_admin (id int); CREATE SEQUENCE public.new_seq; RESET ROLE;`,
);
for (const t of ["new_by_postgres", "new_by_lovable", "new_by_supabase_admin"]) {
  const r = await db.query(
    `SELECT has_table_privilege('anon', 'public.${t}', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS any`,
  );
  check(`new table ${t}: anon has no privileges`, r.rows[0].any === false);
}
const newSeq = await db.query(
  `SELECT has_sequence_privilege('anon', 'public.new_seq', 'USAGE,SELECT,UPDATE') AS any`,
);
check("new sequence: anon has no privileges", newSeq.rows[0].any === false);
const authNew = await db.query(
  `SELECT has_table_privilege('authenticated', 'public.new_by_postgres', 'SELECT') AS s`,
);
check(
  "authenticated default privileges untouched (new table still granted)",
  authNew.rows[0].s === true,
);
const authAfterExisting = ((await db.query(AUTH_GRANTS)).rows[0].g ?? "")
  .split("\n")
  .filter((l) => !l.startsWith("new_"))
  .join("\n");
check(
  "authenticated grants on existing tables byte-for-byte unchanged",
  authAfterExisting === authBefore,
);

// Hosted-like: running role may not alter another owner's defaults -> NOTICE, not error.
const doBlock = MIGRATION.slice(MIGRATION.indexOf("DO $$"));
const skipNotices = [];
let skipErr = null;
try {
  await db.exec(`SET ROLE lovable_owner;`);
  await db.exec(doBlock, { onNotice: (n) => skipNotices.push(n.message) });
} catch (e) {
  skipErr = e.message;
} finally {
  await db.exec(`RESET ROLE;`);
}
check(
  "default-privileges loop skips roles it may not alter (no error)",
  skipErr === null && skipNotices.some((m) => m.includes("SKIPPED role supabase_admin")),
  skipErr ?? skipNotices.filter((m) => m.includes("SKIPPED")).join("; "),
);

await db.close();
const failed = results.filter((r) => !r.pass);
console.log(
  failed.length
    ? `FAIL (${failed.length} of ${results.length})`
    : `PASS (${results.length} checks)`,
);
process.exit(failed.length ? 1 : 0);
