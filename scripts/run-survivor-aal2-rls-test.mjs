#!/usr/bin/env node
/**
 * Local-only PGlite run of supabase/proposals/20261012_survivor_aal2_rls.sql.
 * Never connects to any remote DB. Uses the project's @electric-sql/pglite devDependency
 * (or PGLITE_MODULE=/abs/path/to/pglite/dist/index.js).
 *
 * Cases (role authenticated, PostgREST-style JWT claims):
 *   enrolled + aal1  -> sees 0 rows, cannot insert, cannot read evidence files
 *   enrolled + aal2  -> sees own rows, can insert, can read own files
 *   not enrolled + aal1 -> sees own rows (two-step stays optional)
 *   unverified factor only + aal1 -> allowed (half-finished setup doesn't lock out)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modPath = process.env.PGLITE_MODULE ?? "@electric-sql/pglite";
const { PGlite } = await import(modPath.startsWith("/") ? pathToFileURL(modPath).href : modPath);

const PROPOSAL = readFileSync(
  resolve(root, "supabase/proposals/20261012_survivor_aal2_rls.sql"),
  "utf8",
);

const ENROLLED = "11111111-1111-1111-1111-111111111111";
const PLAIN = "22222222-2222-2222-2222-222222222222";
const HALF = "33333333-3333-3333-3333-333333333333";

const BOOTSTRAP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'sub')::uuid $$;
CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status auth.factor_status NOT NULL);
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('${ENROLLED}', 'verified'), ('${HALF}', 'unverified');
GRANT USAGE ON SCHEMA auth, storage TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO authenticated;

-- Same permissive shape as 20260516191403.
CREATE TABLE public.incidents (id serial PRIMARY KEY, user_id uuid NOT NULL, title text);
CREATE TABLE public.evidence (id serial PRIMARY KEY, user_id uuid NOT NULL, label text);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own incidents" ON public.incidents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own evidence" ON public.evidence FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents, public.evidence TO authenticated;
GRANT USAGE ON SEQUENCE public.incidents_id_seq, public.evidence_id_seq TO authenticated;
INSERT INTO public.incidents (user_id, title) VALUES ('${ENROLLED}', 'e'), ('${PLAIN}', 'p'), ('${HALF}', 'h');
INSERT INTO public.evidence (user_id, label) VALUES ('${ENROLLED}', 'e'), ('${PLAIN}', 'p');

CREATE TABLE storage.objects (id serial PRIMARY KEY, bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;
CREATE POLICY "evidence read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "public bucket read" ON storage.objects FOR SELECT USING (bucket_id = 'public-assets');
GRANT SELECT ON storage.objects TO authenticated;
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('evidence-files', '${ENROLLED}/a.jpg'), ('evidence-files', '${PLAIN}/b.jpg'), ('public-assets', 'logo.png');
`;

const db = new PGlite();
await db.exec(BOOTSTRAP);

async function as(user, aal, fn) {
  await db.exec("BEGIN");
  await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: user, role: "authenticated", aal }),
  ]);
  await db.exec("SET LOCAL ROLE authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("ROLLBACK");
  }
}
const count = async (sql) => (await db.query(sql)).rows.length;
const canInsert = async (user) => {
  try {
    await db.query(`INSERT INTO public.incidents (user_id, title) VALUES ($1, 'x')`, [user]);
    return true;
  } catch {
    return false;
  }
};

let failures = 0;
const expectEq = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: got ${got}, want ${want}`);
};

async function suite(phase, aal1Enrolled) {
  console.log(`--- ${phase} ---`);
  await as(ENROLLED, "aal1", async () => {
    expectEq(
      "enrolled+aal1 incidents visible",
      await count("SELECT * FROM public.incidents"),
      aal1Enrolled.rows,
    );
    expectEq(
      "enrolled+aal1 evidence visible",
      await count("SELECT * FROM public.evidence"),
      aal1Enrolled.rows,
    );
    expectEq(
      "enrolled+aal1 evidence files visible",
      await count("SELECT * FROM storage.objects WHERE bucket_id='evidence-files'"),
      aal1Enrolled.rows,
    );
    expectEq(
      "enrolled+aal1 public bucket unaffected",
      await count("SELECT * FROM storage.objects WHERE bucket_id='public-assets'"),
      1,
    );
  });
  await as(ENROLLED, "aal1", async () =>
    expectEq("enrolled+aal1 can insert", await canInsert(ENROLLED), aal1Enrolled.insert),
  );
  await as(ENROLLED, "aal2", async () => {
    expectEq("enrolled+aal2 incidents visible", await count("SELECT * FROM public.incidents"), 1);
    expectEq(
      "enrolled+aal2 evidence files visible",
      await count("SELECT * FROM storage.objects WHERE bucket_id='evidence-files'"),
      1,
    );
    expectEq("enrolled+aal2 can insert", await canInsert(ENROLLED), true);
  });
  await as(PLAIN, "aal1", async () => {
    expectEq(
      "not-enrolled+aal1 incidents visible",
      await count("SELECT * FROM public.incidents"),
      1,
    );
    expectEq(
      "not-enrolled+aal1 evidence files visible",
      await count("SELECT * FROM storage.objects WHERE bucket_id='evidence-files'"),
      1,
    );
    expectEq("not-enrolled+aal1 can insert", await canInsert(PLAIN), true);
  });
  await as(HALF, "aal1", async () => {
    expectEq(
      "unverified-factor+aal1 incidents visible",
      await count("SELECT * FROM public.incidents"),
      1,
    );
  });
}

// Before: demonstrates the gap Guardian asked about (aal1 reaches records).
await suite("BEFORE proposal (current muy shape)", { rows: 1, insert: true });
await db.exec(PROPOSAL);
await db.exec(PROPOSAL); // idempotent re-apply
await suite("AFTER proposal", { rows: 0, insert: false });

const pol = await db.query(
  `SELECT count(*)::int AS n FROM pg_policies WHERE policyname LIKE 'pp enrolled accounts require aal2%'`,
);
expectEq("restrictive policies present (incidents, evidence, storage)", pol.rows[0].n, 3);

if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
console.log("ALL PASS");
