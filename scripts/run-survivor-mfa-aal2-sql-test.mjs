#!/usr/bin/env node
/**
 * Local-only PGlite run of the survivor optional-2FA restrictive policy
 * (supabase/migrations/20261012200000_survivor_optional_mfa_aal2.sql).
 * Never connects to any remote DB. PGlite is not a project dependency:
 *   PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/run-survivor-mfa-aal2-sql-test.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modPath = process.env.PGLITE_MODULE ?? "@electric-sql/pglite";
const { PGlite } = await import(modPath.startsWith("/") ? pathToFileURL(modPath).href : modPath);
const MIGRATION = readFileSync(
  resolve(root, "supabase/migrations/20261012200000_survivor_optional_mfa_aal2.sql"),
  "utf8",
);

const ENROLLED = "00000000-0000-4000-8000-0000000000e1";
const PLAIN = "00000000-0000-4000-8000-0000000000e2";
const OTHER = "00000000-0000-4000-8000-0000000000e3";

const db = new PGlite();
await db.exec(`
  DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt() ->> 'sub')::uuid $$;
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status auth.factor_status NOT NULL);
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO authenticated, anon;
  CREATE TABLE public.incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text);
  CREATE TABLE public.evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text);
  CREATE TABLE public.entry_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, body text);
  CREATE TABLE public.consent_grants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), survivor_user_id uuid NOT NULL, recipient_user_id uuid NOT NULL);
  DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['incidents','evidence','entry_drafts'] LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('CREATE POLICY own ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    END LOOP; END $$;
  ALTER TABLE public.consent_grants ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.consent_grants TO authenticated;
  CREATE POLICY own ON public.consent_grants FOR SELECT TO authenticated USING (survivor_user_id = auth.uid());
  INSERT INTO auth.mfa_factors (user_id, status) VALUES ('${ENROLLED}', 'verified'), ('${PLAIN}', 'unverified');
  INSERT INTO public.incidents (user_id, title) VALUES ('${ENROLLED}', 'e'), ('${PLAIN}', 'p'), ('${OTHER}', 'o');
  INSERT INTO public.evidence (user_id, title) VALUES ('${ENROLLED}', 'e'), ('${PLAIN}', 'p');
  INSERT INTO public.entry_drafts (user_id, body) VALUES ('${ENROLLED}', 'e'), ('${PLAIN}', 'p');
  INSERT INTO public.consent_grants (survivor_user_id, recipient_user_id) VALUES ('${ENROLLED}', '${OTHER}'), ('${PLAIN}', '${OTHER}');
`);
await db.exec(MIGRATION);
await db.exec(MIGRATION); // idempotent re-apply

async function as(uid, aal, sql, role = "authenticated") {
  const claims = JSON.stringify({ sub: uid, role, aal });
  await db.exec(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claims', '${claims}', true);`);
  try {
    const r = await db.query(sql);
    await db.exec("ROLLBACK");
    return { ok: true, rows: r.rows, n: r.affectedRows ?? r.rows.length };
  } catch (e) {
    await db.exec("ROLLBACK");
    return { ok: false, code: e.code };
  }
}
const count = async (uid, aal, t) => (await as(uid, aal, `SELECT count(*)::int AS n FROM public.${t}`)).rows?.[0]?.n;

const checks = [];
for (const t of ["incidents", "evidence", "entry_drafts", "consent_grants"]) {
  checks.push([`${t}: enrolled + aal1 reads 0 rows`, (await count(ENROLLED, "aal1", t)) === 0]);
  checks.push([`${t}: enrolled + aal2 reads own row`, (await count(ENROLLED, "aal2", t)) === 1]);
  checks.push([`${t}: not enrolled + aal1 reads own row`, (await count(PLAIN, "aal1", t)) === 1]);
}
checks.push(["other user (aal2) still sees only own incidents", (await count(OTHER, "aal2", "incidents")) === 1]);
const ins1 = await as(ENROLLED, "aal1", `INSERT INTO public.incidents (user_id, title) VALUES ('${ENROLLED}', 'x')`);
checks.push(["enrolled + aal1 INSERT denied (42501)", !ins1.ok && ins1.code === "42501"]);
const ins2 = await as(ENROLLED, "aal2", `INSERT INTO public.incidents (user_id, title) VALUES ('${ENROLLED}', 'x')`);
checks.push(["enrolled + aal2 INSERT allowed", ins2.ok]);
const upd = await as(ENROLLED, "aal1", `UPDATE public.evidence SET title = 'z'`);
checks.push(["enrolled + aal1 UPDATE touches 0 rows", upd.ok && upd.n === 0]);
const insPlain = await as(PLAIN, "aal1", `INSERT INTO public.incidents (user_id, title) VALUES ('${PLAIN}', 'x')`);
checks.push(["not enrolled + aal1 INSERT allowed", insPlain.ok]);
const cross = await as(PLAIN, "aal1", `INSERT INTO public.incidents (user_id, title) VALUES ('${ENROLLED}', 'x')`);
checks.push(["not enrolled cannot write another user's row", !cross.ok]);

const fn = await db.query(`SELECT prosecdef, proconfig,
  has_function_privilege('anon', 'public.current_user_has_verified_mfa()', 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', 'public.current_user_has_verified_mfa()', 'EXECUTE') AS auth_exec
  FROM pg_proc WHERE proname = 'current_user_has_verified_mfa'`);
const f = fn.rows[0];
checks.push(["helper is SECURITY DEFINER", f.prosecdef === true]);
checks.push(["helper search_path is empty", (f.proconfig ?? []).some((c) => /^search_path=(""|)$/.test(c))]);
checks.push(["anon cannot execute helper", f.anon_exec === false]);
checks.push(["authenticated can execute helper", f.auth_exec === true]);
const pol = await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname = 'Enrolled accounts require aal2' AND permissive = 'RESTRICTIVE'`);
checks.push(["one restrictive policy per present table (4) after re-apply", pol.rows[0].n === 4]);

let fail = false;
for (const [label, pass] of checks) {
  console.log(`  ${pass ? "ok  " : "FAIL"} - ${label}`);
  if (!pass) fail = true;
}
await db.close();
if (fail) process.exit(1);
console.log(`PASS (${checks.length} checks)`);
