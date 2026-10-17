import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIG = readFileSync(
  "supabase/migrations/20261014220000_accept_share_confirmed_email.sql",
  "utf8",
);
const HELPER = MIG.slice(
  0,
  MIG.indexOf("CREATE OR REPLACE FUNCTION public.accept_attorney_share("),
);
const ACCEPT = MIG.slice(MIG.indexOf("CREATE OR REPLACE FUNCTION public.accept_attorney_share("));
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Like muy: service_role has no SELECT on auth.users.
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    GRANT USAGE ON SCHEMA private, auth TO service_role, authenticated;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    REVOKE ALL ON auth.users FROM PUBLIC, anon, authenticated, service_role;
    INSERT INTO auth.users VALUES
      ('00000000-0000-4000-8000-000000000001', 'Atty@Example.invalid', now()),
      ('00000000-0000-4000-8000-000000000002', 'unconfirmed@example.invalid', NULL);
  `);
  await db.exec(HELPER);
  // The replaced accept function must compile as written (plpgsql syntax check).
  await db.exec("CREATE TABLE public.attorney_client_links (id uuid PRIMARY KEY)");
  await db.exec(ACCEPT);
}, 30_000);
afterAll(async () => db?.close());

describe("accept_attorney_share auth.users fix", () => {
  it("service_role cannot read auth.users directly (the live failure)", async () => {
    await db.exec("SET ROLE service_role");
    try {
      await expect(db.query("SELECT email FROM auth.users")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("service_role gets the confirmed email (lower-cased) through the helper; unconfirmed -> null", async () => {
    await db.exec("SET ROLE service_role");
    try {
      const r = await db.query<{ a: string | null; b: string | null }>(
        `SELECT private.confirmed_account_email('00000000-0000-4000-8000-000000000001') a,
                private.confirmed_account_email('00000000-0000-4000-8000-000000000002') b`,
      );
      expect(r.rows[0]).toEqual({ a: "atty@example.invalid", b: null });
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("helper is SECURITY DEFINER, empty search_path, and not executable by PUBLIC/anon/authenticated", async () => {
    const r = await db.query<{ d: boolean; cfg: string[]; a: boolean; u: boolean; s: boolean }>(
      `SELECT p.prosecdef d, p.proconfig cfg,
        has_function_privilege('anon', p.oid, 'EXECUTE') a,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') u,
        has_function_privilege('service_role', p.oid, 'EXECUTE') s
       FROM pg_proc p WHERE p.oid = 'private.confirmed_account_email(uuid)'::regprocedure`,
    );
    expect(r.rows[0]).toEqual({ d: true, cfg: ['search_path=""'], a: false, u: false, s: true });
  });
  it("accept_attorney_share no longer reads auth.users and keeps its checks and grants", () => {
    expect(ACCEPT).not.toMatch(/FROM\s+auth\.users/i);
    expect(ACCEPT).toContain("actor_email := private.confirmed_account_email(_actor_id);");
    expect(ACCEPT).toMatch(/SECURITY INVOKER SET search_path = ''/);
    for (const check of [
      "Invitation is invalid or expired",
      "A matching confirmed account is required",
      "Attorney approval required",
      "Scope exceeds the invitation",
    ])
      expect(ACCEPT).toContain(check);
    expect(ACCEPT).toContain(
      "REVOKE ALL ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;",
    );
    expect(ACCEPT).toContain(
      "GRANT EXECUTE ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) TO service_role;",
    );
  });
});
