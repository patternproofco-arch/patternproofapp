#!/usr/bin/env node
// Local-only. PGlite (in-process Postgres), synthetic data, never a remote DB.
// 1) Builds attorney_profiles exactly as the migrations do (table, trial/onboarding columns,
//    "Attorneys manage own profile" ALL policy, authenticated grants, firm_id guard).
// 2) Runs supabase/tests/sql/attorney_trial_lock.test.sql WITHOUT the new migration: it must FAIL.
// 3) Applies 20261011210000_lock_attorney_trial_fields.sql twice, then the test must PASS.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TABLE public.firm_members(firm_id uuid, user_id uuid);
-- 20260526165258: table, grants, RLS, owner ALL policy, touch trigger
CREATE TABLE public.attorney_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL, firm_name text, bar_number text, jurisdiction text, email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.attorney_profiles TO authenticated;
GRANT ALL ON public.attorney_profiles TO service_role;
ALTER TABLE public.attorney_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attorneys manage own profile" ON public.attorney_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER attorney_profiles_touch_updated_at BEFORE UPDATE ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- 20260623010659 / 20260630185944 / 20260906225917 columns, types.ts shape
ALTER TABLE public.attorney_profiles
  ADD COLUMN confidentiality_accepted_at timestamptz, ADD COLUMN onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN role text, ADD COLUMN firm_id uuid,
  ADD COLUMN trial_started_at timestamptz, ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN trial_comped boolean NOT NULL DEFAULT false;
INSERT INTO auth.users(id,email) VALUES
 ('11111111-1111-4111-8111-111111111111','a@patternproof.test'),
 ('22222222-2222-4222-8222-222222222222','b@patternproof.test'),
 ('33333333-3333-4333-8333-333333333333','c@patternproof.test');
INSERT INTO public.attorney_profiles(user_id, full_name, email) VALUES
 ('11111111-1111-4111-8111-111111111111','A','a@patternproof.test');`);
  await db.exec(read("supabase/migrations/20260827160000_attorney_profiles_firm_id_guard.sql"));
  return db;
}

const TEST = "BEGIN;\n" + read("supabase/tests/sql/attorney_trial_lock.test.sql") + "\nCOMMIT;";
const MIGRATION = read("supabase/migrations/20261011210000_lock_attorney_trial_fields.sql");

const before = await fixture();
let failedBefore = false;
try {
  await before.exec(TEST);
} catch (e) {
  failedBefore = true;
  console.log(`expected failure without the migration: ${e.message}`);
}
await before.close();
if (!failedBefore) {
  console.error("FAIL: the test passed without the migration, so it does not detect the gap");
  process.exit(1);
}

const after = await fixture();
await after.exec(MIGRATION);
await after.exec(MIGRATION);
await after.exec(TEST, { onNotice: (n) => console.log(n.message) });
await after.close();
console.log("PASS: attorney trial lock (PGlite, synthetic data)");
