#!/usr/bin/env node
/**
 * Local-only behavioural run of supabase/tests/sql/acl_client_update_guard.test.sql
 * using PGlite (in-process WASM Postgres). Never connects to any remote DB.
 *
 * PGlite is NOT a project dependency (no lockfile change). Install it in a
 * scratch dir and point at it, e.g.:
 *   mkdir -p /tmp/pglite && (cd /tmp/pglite && npm i @electric-sql/pglite@0.3)
 *   PGLITE_MODULE=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
 *     node scripts/run-acl-guard-sql-test.mjs
 *
 * Steps:
 *  1. Minimal Supabase stand-ins: auth.uid() (same JWT-claim lookup as Supabase).
 *  2. public.attorney_client_links with every column the migrations add
 *     (mirrors src/integrations/supabase/types.ts), plus the real
 *     touch_case_notes trigger migration.
 *  3. The OLD guard from 20260802020440, then the test is run and MUST FAIL
 *     (proves the test detects C7).
 *  4. The NEW migration 20261008120000 on top (proves CREATE OR REPLACE +
 *     trigger recreate is idempotent: applied twice), then the test MUST PASS.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const modPath = process.env.PGLITE_MODULE ?? "@electric-sql/pglite";
const { PGlite } = await import(modPath.startsWith("/") ? pathToFileURL(modPath).href : modPath);

const BOOTSTRAP = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
CREATE TABLE public.attorney_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  invitation_id uuid,
  scope_incidents uuid[] NOT NULL DEFAULT '{}',
  scope_evidence uuid[] NOT NULL DEFAULT '{}',
  include_all_incidents boolean NOT NULL DEFAULT true,
  include_all_evidence boolean NOT NULL DEFAULT true,
  include_patterns boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  attorney_case_notes text,
  org_id uuid,
  deposition_prep_consent boolean NOT NULL DEFAULT false,
  deposition_prep_consent_at timestamptz,
  case_id uuid,
  clio_share_consent boolean NOT NULL DEFAULT false,
  clio_share_consent_at timestamptz,
  include_voice_notes boolean NOT NULL DEFAULT false,
  include_communications boolean NOT NULL DEFAULT false,
  include_legal_documents boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  UNIQUE (attorney_user_id, client_user_id)
);
`;

const oldGuardSrc = read(
  "supabase/migrations/20260802020440_3c2a141d-de1c-45ce-9344-c48df46c709d.sql",
);
const OLD_GUARD = oldGuardSrc.slice(
  oldGuardSrc.indexOf(
    "CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard",
  ),
);
const TOUCH_NOTES = read("supabase/migrations/20260917143533_attorney_case_notes_updated_at.sql");
const NEW_MIGRATION = read(
  "supabase/migrations/20261008120000_acl_client_update_guard_allowlist.sql",
);
const TEST = read("supabase/tests/sql/acl_client_update_guard.test.sql");

async function runTest(db, label) {
  const notices = [];
  try {
    await db.exec(TEST, {
      onNotice: (n) => {
        if (/^(ok|ALL)/.test(n.message)) notices.push(n.message);
      },
    });
    return { ok: true, notices };
  } catch (e) {
    await db.exec("ROLLBACK").catch(() => {});
    return { ok: false, notices, error: String(e.message ?? e), label };
  }
}

const db = new PGlite();
await db.exec(BOOTSTRAP);
await db.exec(TOUCH_NOTES);
await db.exec(OLD_GUARD);

const before = await runTest(db, "old guard");
if (before.ok) {
  console.error("UNEXPECTED: test passed against the OLD guard; it does not detect C7.");
  process.exit(1);
}
console.log(`[old guard] test failed as expected: ${before.error}`);

await db.exec(NEW_MIGRATION);
await db.exec(NEW_MIGRATION); // idempotent re-apply

const trig = await db.query(
  `SELECT count(*)::int AS n FROM pg_trigger
    WHERE tgrelid = 'public.attorney_client_links'::regclass
      AND tgname = 'attorney_client_links_client_update_guard' AND NOT tgisinternal`,
);
if (trig.rows[0].n !== 1) {
  console.error(`FAIL: expected exactly 1 guard trigger, found ${trig.rows[0].n}`);
  process.exit(1);
}
const cfg = await db.query(
  `SELECT proconfig, prosecdef FROM pg_proc
    WHERE oid = 'public.attorney_client_links_client_update_guard()'::regprocedure`,
);
console.log(
  `[new guard] proconfig=${JSON.stringify(cfg.rows[0].proconfig)} security_definer=${cfg.rows[0].prosecdef}`,
);

const after = await runTest(db, "new guard");
for (const n of after.notices) console.log(`  ${n}`);
if (!after.ok) {
  console.error(`FAIL against NEW guard: ${after.error}`);
  process.exit(1);
}
const okCount = after.notices.filter((n) => n.startsWith("ok")).length;
console.log(`[new guard] PASS (${okCount} cases)`);

// RLS-level smoke, PostgREST-style: role authenticated + the real UPDATE policies
// from 20260531004819 / 20260802020440 (attorneys have no UPDATE policy).
const SURVIVOR = "00000000-0000-4000-8000-0000000000aa";
const ATTORNEY = "00000000-0000-4000-8000-0000000000bb";
await db.exec(`
  DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.attorney_client_links TO authenticated;
  ALTER TABLE public.attorney_client_links ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Participants read links" ON public.attorney_client_links FOR SELECT TO authenticated
    USING (auth.uid() = client_user_id OR (auth.uid() = attorney_user_id AND status = 'active'
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())));
  CREATE POLICY "Clients revoke own links" ON public.attorney_client_links FOR UPDATE TO authenticated
    USING (auth.uid() = client_user_id) WITH CHECK (auth.uid() = client_user_id AND status = 'revoked' AND revoked_at IS NOT NULL);
  CREATE POLICY "Clients manage clio share consent" ON public.attorney_client_links FOR UPDATE TO authenticated
    USING (auth.uid() = client_user_id) WITH CHECK (auth.uid() = client_user_id);
  INSERT INTO public.attorney_client_links (attorney_user_id, client_user_id, expires_at, include_all_incidents, include_all_evidence)
    VALUES ('${ATTORNEY}', '${SURVIVOR}', now() + interval '7 days', false, false);
`);
async function asRole(uid, sql) {
  await db.exec(`BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);`);
  try {
    const r = await db.query(sql);
    await db.exec("COMMIT");
    return { ok: true, n: r.affectedRows ?? 0 };
  } catch (e) {
    await db.exec("ROLLBACK");
    return { ok: false, code: e.code, msg: e.message };
  }
}
const rls = [];
const c7 = await asRole(
  SURVIVOR,
  `UPDATE public.attorney_client_links SET expires_at = now() + interval '365 days'`,
);
rls.push(["survivor JWT PATCH expires_at (C7 probe) -> 42501", !c7.ok && c7.code === "42501"]);
const att = await asRole(
  ATTORNEY,
  `UPDATE public.attorney_client_links SET expires_at = now() + interval '365 days'`,
);
rls.push(["attorney JWT PATCH -> 0 rows (RLS, unchanged)", att.ok && att.n === 0]);
const clio = await asRole(
  SURVIVOR,
  `UPDATE public.attorney_client_links SET clio_share_consent = true, clio_share_consent_at = now()`,
);
rls.push(["survivor JWT Clio consent -> 1 row", clio.ok && clio.n === 1]);
// UI-style revoke but with a backdated client timestamp: must succeed and be
// stored as server now(), not 1970.
const rev = await asRole(
  SURVIVOR,
  `UPDATE public.attorney_client_links SET status = 'revoked', revoked_at = '1970-01-01T00:00:00Z'`,
);
rls.push(["survivor JWT revoke (backdated 1970 input) -> 1 row", rev.ok && rev.n === 1]);
const stored = await db.query(
  `SELECT extract(epoch FROM (clock_timestamp() - revoked_at))::float8 AS age_s
     FROM public.attorney_client_links WHERE client_user_id = '${SURVIVOR}'`,
);
const ageS = stored.rows[0]?.age_s;
rls.push([
  `stored revoked_at overridden to server now() (age ${ageS?.toFixed?.(3)}s)`,
  typeof ageS === "number" && ageS >= 0 && ageS < 5,
]);
const rearm = await asRole(
  SURVIVOR,
  `UPDATE public.attorney_client_links SET status = 'active', revoked_at = NULL`,
);
rls.push(["survivor JWT re-arm after revoke -> 42501", !rearm.ok && rearm.code === "42501"]);
let rlsFail = false;
for (const [label, pass] of rls) {
  console.log(`  ${pass ? "ok  " : "FAIL"} - RLS: ${label}`);
  if (!pass) rlsFail = true;
}
await db.close();
if (rlsFail) process.exit(1);
console.log("[rls smoke] PASS");
