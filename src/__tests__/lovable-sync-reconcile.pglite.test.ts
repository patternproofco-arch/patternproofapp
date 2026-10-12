import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * End state of 0035_lovable_sync_reconcile on a synthetic database that starts
 * in the worst state the merged history can leave behind (Lovable's looser
 * guard live, anon INSERTs and sequence rights, anon default ACLs, a scheduled
 * purge job, SECURITY DEFINER helpers callable by PUBLIC). Local PGlite only;
 * no remote database, no real records.
 */
const RECONCILE = readFileSync(
  "supabase/migrations/20261011200000_lovable_sync_reconcile.sql",
  "utf8",
);
const SURVIVOR = "00000000-0000-4000-8000-0000000000aa";
const ATTORNEY = "00000000-0000-4000-8000-0000000000bb";
let db: PGlite;
const notices: string[] = [];

const BASE = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA cron;
GRANT USAGE ON SCHEMA public, auth, private TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
-- Supabase-like defaults that hand anon everything.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE public.attorney_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attorney_user_id uuid NOT NULL, client_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active', revoked_at timestamptz, expires_at timestamptz,
  scope_incidents uuid[] NOT NULL DEFAULT '{}', clio_share_consent boolean NOT NULL DEFAULT false,
  clio_share_consent_at timestamptz);
ALTER TABLE public.attorney_client_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read links" ON public.attorney_client_links FOR SELECT TO authenticated
  USING (auth.uid() IN (client_user_id, attorney_user_id));
CREATE POLICY "Clients revoke own links" ON public.attorney_client_links FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id);
CREATE TABLE public.consent_grants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, status text);
ALTER TABLE public.consent_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Survivor updates own grants" ON public.consent_grants FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.feedback_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), audience text, user_id uuid);
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anonymous users can submit org feedback" ON public.feedback_submissions FOR INSERT TO anon
  WITH CHECK (audience = 'org' AND user_id IS NULL);
CREATE TABLE public.org_access_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE TABLE public.marketing_leads (id bigserial PRIMARY KEY, email text);
CREATE TABLE public.entry_drafts (user_id uuid, kind text, updated_at timestamptz, PRIMARY KEY (user_id, kind));
CREATE TABLE public.user_webauthn_credentials (id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.user_webauthn_challenges (id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.attorney_entry_reviews (id uuid PRIMARY KEY, user_id uuid);
CREATE TABLE public.attorney_applications (id uuid PRIMARY KEY, email text);
CREATE TABLE public.study_profiles (user_id uuid PRIMARY KEY);
CREATE TABLE public.user_lesson_progress (id uuid PRIMARY KEY, user_id uuid);
CREATE FUNCTION public.has_role(_u uuid, _r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = '' AS $$ SELECT false $$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO PUBLIC;
CREATE FUNCTION public.plain_helper() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
CREATE FUNCTION private.attorney_is_approved(_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  AS $$ SELECT true $$;
-- Minimal pg_cron stand-in.
CREATE TABLE cron.job (jobid bigserial PRIMARY KEY, jobname text, schedule text, command text, active boolean DEFAULT true);
CREATE FUNCTION cron.unschedule(_id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = _id RETURNING true $$;
INSERT INTO cron.job (jobname, schedule, command, active)
  VALUES ('purge-old-entry-drafts', '17 3 * * *', 'DELETE FROM public.entry_drafts', false);
GRANT INSERT ON public.org_access_requests, public.marketing_leads TO anon;
CREATE SCHEMA storage;
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
CREATE POLICY "evidence read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "voice insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-notes' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own message-exports" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'message-exports' AND (auth.uid())::text = (storage.foldername(name))[1]);
`;

async function asUser(uid: string, sql: string) {
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
  }
}
async function code(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}
const priv = async (sql: string) =>
  (await db.query<{ v: boolean }>(`SELECT (${sql}) AS v`)).rows[0].v;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE);
  // Lovable's original 0027 (the guard live on the published database today).
  await db.exec(readFileSync("src/__tests__/fixtures/lovable-0027-original.sql", "utf8"));
  // Reconcile twice: it must be idempotent.
  for (let i = 0; i < 2; i++)
    await db.exec(RECONCILE, {
      onNotice: (n: { message?: string }) => notices.push(n.message ?? ""),
    } as never);
}, 60_000);
afterAll(async () => db?.close());

describe("Lovable sync reconcile end state (PGlite)", () => {
  it("installs the #197 guard: server revoke time, empty search_path", async () => {
    const r = await db.query<{ src: string; cfg: string[] }>(
      `SELECT prosrc AS src, proconfig AS cfg FROM pg_proc WHERE proname = 'attorney_client_links_client_update_guard'`,
    );
    expect(r.rows[0].src).toContain("NEW.revoked_at := now();");
    expect(r.rows[0].cfg).toEqual(['search_path=""']);
  });

  it("survivor revoke stores server time; revoke + consent or other columns are rejected", async () => {
    const ins = await db.query<{ id: string }>(
      `INSERT INTO public.attorney_client_links (attorney_user_id, client_user_id) VALUES ('${ATTORNEY}', '${SURVIVOR}'), ('${ATTORNEY}', '${SURVIVOR}') RETURNING id`,
    );
    const [a, b] = ins.rows.map((r) => r.id);
    expect(
      await code(
        asUser(
          SURVIVOR,
          `UPDATE public.attorney_client_links SET status='revoked', revoked_at=now(), clio_share_consent=true WHERE id='${b}'`,
        ),
      ),
    ).toBe("42501");
    expect(
      await code(
        asUser(
          SURVIVOR,
          `UPDATE public.attorney_client_links SET expires_at=now() WHERE id='${b}'`,
        ),
      ),
    ).toBe("42501");
    await asUser(
      SURVIVOR,
      `UPDATE public.attorney_client_links SET status='revoked', revoked_at='1970-01-01T00:00:00Z' WHERE id='${a}'`,
    );
    const row = await db.query<{ ok: boolean }>(
      `SELECT revoked_at > now() - interval '1 minute' AS ok FROM public.attorney_client_links WHERE id='${a}'`,
    );
    expect(row.rows[0].ok).toBe(true);
    expect(
      await code(
        asUser(
          SURVIVOR,
          `UPDATE public.attorney_client_links SET status='active', revoked_at=NULL WHERE id='${a}'`,
        ),
      ),
    ).toBe("42501");
  });

  it("links: column-level UPDATE only; consent_grants: service_role writes only", async () => {
    expect(
      await priv(`has_table_privilege('authenticated','public.attorney_client_links','UPDATE')`),
    ).toBe(false);
    expect(
      await priv(`has_table_privilege('authenticated','public.attorney_client_links','INSERT')`),
    ).toBe(false);
    expect(
      await priv(`has_table_privilege('authenticated','public.attorney_client_links','DELETE')`),
    ).toBe(false);
    for (const c of ["clio_share_consent", "clio_share_consent_at", "status", "revoked_at"])
      expect(
        await priv(
          `has_column_privilege('authenticated','public.attorney_client_links','${c}','UPDATE')`,
        ),
      ).toBe(true);
    expect(
      await priv(
        `has_column_privilege('authenticated','public.attorney_client_links','expires_at','UPDATE')`,
      ),
    ).toBe(false);
    for (const p of ["INSERT", "UPDATE", "DELETE"]) {
      expect(
        await priv(`has_table_privilege('authenticated','public.consent_grants','${p}')`),
      ).toBe(false);
      expect(await priv(`has_table_privilege('service_role','public.consent_grants','${p}')`)).toBe(
        true,
      );
    }
  });

  it("anon keeps only INSERT on feedback_submissions; no sequences; no anon default ACLs", async () => {
    const t = await db.query<{ n: string; p: string }>(
      `SELECT table_name AS n, privilege_type AS p FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public'`,
    );
    expect(t.rows).toEqual([{ n: "feedback_submissions", p: "INSERT" }]);
    expect(
      await priv(`has_sequence_privilege('anon','public.marketing_leads_id_seq','USAGE')`),
    ).toBe(false);
    const d = await db.query(
      `SELECT 1 FROM pg_default_acl d, aclexplode(d.defaclacl) a WHERE a.grantee = 'anon'::regrole`,
    );
    expect(d.rows).toHaveLength(0);
    expect(notices.some((n) => n.includes("supabase_admin default privileges not changed"))).toBe(
      true,
    );
  });

  it("SECURITY DEFINER functions in public: no anon/PUBLIC EXECUTE, authenticated unchanged", async () => {
    expect(
      await priv(`has_function_privilege('anon','public.has_role(uuid,text)','EXECUTE')`),
    ).toBe(false);
    expect(
      await priv(`has_function_privilege('authenticated','public.has_role(uuid,text)','EXECUTE')`),
    ).toBe(true);
    const acl = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname='has_role' AND a.grantee=0`,
    );
    expect(acl.rows[0].n).toBe(0);
    await db.exec(
      `CREATE FUNCTION public.new_after_reconcile() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;`,
    );
    expect(
      await priv(`has_function_privilege('anon','public.new_after_reconcile()','EXECUTE')`),
    ).toBe(false);
    expect(
      await priv(
        `has_function_privilege('authenticated','public.new_after_reconcile()','EXECUTE')`,
      ),
    ).toBe(true);
  });

  it("has_attorney_access keeps #207's approval check", async () => {
    const r = await db.query<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='has_attorney_access'`,
    );
    expect(r.rows[0].src).toContain("private.attorney_is_approved(_attorney_id)");
  });

  it("removes the purge cron job outright", async () => {
    const r = await db.query(`SELECT 1 FROM cron.job WHERE jobname='purge-old-entry-drafts'`);
    expect(r.rows).toHaveLength(0);
  });

  it("new Lovable tables: RLS on, no anon grants, server-only or owner-only", async () => {
    for (const t of [
      "user_webauthn_credentials",
      "user_webauthn_challenges",
      "attorney_entry_reviews",
      "attorney_applications",
      "study_profiles",
      "user_lesson_progress",
    ]) {
      expect(
        await priv(`(SELECT relrowsecurity FROM pg_class WHERE oid='public.${t}'::regclass)`),
      ).toBe(true);
      expect(
        await priv(`has_table_privilege('anon','public.${t}','SELECT,INSERT,UPDATE,DELETE')`),
      ).toBe(false);
    }
    for (const t of [
      "user_webauthn_credentials",
      "user_webauthn_challenges",
      "attorney_entry_reviews",
      "attorney_applications",
    ])
      expect(
        await priv(
          `has_table_privilege('authenticated','public.${t}','SELECT,INSERT,UPDATE,DELETE')`,
        ),
      ).toBe(false);
    const pol = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policies WHERE tablename IN ('study_profiles','user_lesson_progress') AND qual NOT LIKE '%auth.uid() = user_id%' AND with_check NOT LIKE '%auth.uid() = user_id%'`,
    );
    expect(pol.rows[0].n).toBe(0);
  });

  it("storage policies: authenticated only, same expressions; message-exports UPDATE has WITH CHECK", async () => {
    const r = await db.query<{
      policyname: string;
      roles: string[];
      qual: string | null;
      with_check: string | null;
    }>(
      `SELECT policyname, roles, qual, with_check FROM pg_policies WHERE schemaname='storage' ORDER BY policyname`,
    );
    for (const p of r.rows) expect(p.roles).toEqual(["authenticated"]);
    const read = r.rows.find((p) => p.policyname === "evidence read own")!;
    expect(read.qual).toContain("evidence-files");
    const upd = r.rows.find((p) => p.policyname === "users update own message-exports")!;
    expect(upd.with_check).toBe(upd.qual);
  });
});
