import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * End state of 0040_lovable_sync_reconcile on a synthetic database that starts
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
CREATE ROLE supabase_auth_admin NOLOGIN;
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
  scope_incidents uuid[] NOT NULL DEFAULT '{}', scope_evidence uuid[] NOT NULL DEFAULT '{}', clio_share_consent boolean NOT NULL DEFAULT false,
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
-- Stand-in for the validated evidence-response RPC; the guard trusts its owner role.
CREATE FUNCTION public.respond_to_evidence_request(uuid, text, text, uuid[]) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT $$;
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
  // A custom access-token hook that supabase_auth_admin reaches only through PUBLIC.
  await db.exec(`CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN RETURN event; END $$;
    REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO PUBLIC;`);
  // Reconcile twice: it must be idempotent.
  for (let i = 0; i < 2; i++)
    await db.exec(RECONCILE, {
      onNotice: (n: { message?: string }) => notices.push(n.message ?? ""),
    } as never);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261013150000_followup_trigger_fn_grants.sql",
      "utf8",
    ).replace(/^REVOKE EXECUTE ON FUNCTION private\.\w+\(\) FROM PUBLIC;$/gm, ""),
  );
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

  it("only the respond_to_evidence_request owner may grow scope_evidence (live muy block)", async () => {
    const ins = await db.query<{ id: string }>(
      `INSERT INTO public.attorney_client_links (attorney_user_id, client_user_id, scope_evidence) VALUES ('${ATTORNEY}', '${SURVIVOR}', '{00000000-0000-4000-8000-000000000001}') RETURNING id`,
    );
    const id = ins.rows[0].id;
    const asOwner = async (sql: string) => {
      await db.exec(`SELECT set_config('request.jwt.claim.sub', '${SURVIVOR}', false);`);
      try {
        return await db.query(sql);
      } finally {
        await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
      }
    };
    await asOwner(
      `UPDATE public.attorney_client_links SET scope_evidence = scope_evidence || '00000000-0000-4000-8000-000000000002'::uuid WHERE id='${id}'`,
    );
    const n = await db.query<{ n: number }>(
      `SELECT cardinality(scope_evidence) AS n FROM public.attorney_client_links WHERE id='${id}'`,
    );
    expect(n.rows[0].n).toBe(2);
    expect(
      await code(
        asOwner(`UPDATE public.attorney_client_links SET scope_evidence='{}' WHERE id='${id}'`),
      ),
    ).toBe("42501");
    expect(
      await code(
        asOwner(
          `UPDATE public.attorney_client_links SET scope_evidence = scope_evidence || '00000000-0000-4000-8000-000000000003'::uuid, expires_at=now() WHERE id='${id}'`,
        ),
      ),
    ).toBe("42501");
  });

  it("follow-up: the guard trigger function is not executable by PUBLIC/anon/authenticated", async () => {
    for (const r of ["anon", "authenticated"])
      expect(
        await priv(
          `has_function_privilege('${r}','public.attorney_client_links_client_update_guard()','EXECUTE')`,
        ),
      ).toBe(false);
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

  it("auth hook reachable only via PUBLIC keeps supabase_auth_admin EXECUTE; anon loses it", async () => {
    const hook = "public.custom_access_token_hook(jsonb)";
    expect(await priv(`has_function_privilege('supabase_auth_admin','${hook}','EXECUTE')`)).toBe(
      true,
    );
    expect(await priv(`has_function_privilege('anon','${hook}','EXECUTE')`)).toBe(false);
    // authenticated also had it through PUBLIC, so it keeps it explicitly.
    expect(await priv(`has_function_privilege('authenticated','${hook}','EXECUTE')`)).toBe(true);
    const pub = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='${hook}'::regprocedure)) a WHERE a.grantee=0`,
    );
    expect(pub.rows[0].n).toBe(0);
  });

  it("undo snapshot: pre-revoke ACLs kept (first run wins), server-only table", async () => {
    const r = await db.query<{ fn: string; had_public: boolean }>(
      `SELECT fn, had_public FROM public._reconcile_secdef_acl_snapshot ORDER BY fn`,
    );
    const byFn = Object.fromEntries(r.rows.map((x) => [x.fn, x.had_public]));
    expect(byFn["public.custom_access_token_hook(jsonb)"]).toBe(true);
    expect(byFn["public.has_role(uuid, text)"]).toBe(true);
    expect(
      await priv(
        `(SELECT relrowsecurity FROM pg_class WHERE oid='public._reconcile_secdef_acl_snapshot'::regclass)`,
      ),
    ).toBe(true);
    for (const role of ["anon", "authenticated"])
      for (const p of ["SELECT", "INSERT", "UPDATE", "DELETE"])
        expect(
          await priv(
            `has_table_privilege('${role}','public._reconcile_secdef_acl_snapshot','${p}')`,
          ),
        ).toBe(false);
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

describe("SECTION 3 undo (runs last; changes the state)", () => {
  it("re-grants PUBLIC EXECUTE exactly where the snapshot says it was", async () => {
    await db.exec(
      readFileSync(
        "supabase/rollbacks/20261011200000_lovable_sync_reconcile.undo-secdef-execute.sql",
        "utf8",
      ),
      { onNotice: () => undefined } as never,
    );
    expect(
      await priv(
        `has_function_privilege('anon','public.custom_access_token_hook(jsonb)','EXECUTE')`,
      ),
    ).toBe(true);
    const stillClosed = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public._reconcile_secdef_acl_snapshot s
        WHERE NOT s.had_public AND has_function_privilege('anon', s.fn::regprocedure, 'EXECUTE')`,
    );
    expect(stillClosed.rows[0].n).toBe(0);
  });
});
