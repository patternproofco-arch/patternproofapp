import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * C7: survivor JWT must only be able to (i) toggle Clio consent or (ii) do a
 * one-way revoke on its own attorney_client_links row. Static contract for
 * migration 20261008120000; the behavioural run lives in
 * supabase/tests/sql/acl_client_update_guard.test.sql
 * (scripts/run-acl-guard-sql-test.mjs runs it on PGlite locally).
 */

const MIGRATION = "supabase/migrations/20261008120000_acl_client_update_guard_allowlist.sql";
const DRIZZLE = "drizzle/migrations/0008_acl_client_update_guard_allowlist.sql";
const SQL_TEST = "supabase/tests/sql/acl_client_update_guard.test.sql";

const sql = readFileSync(MIGRATION, "utf8");
const flat = sql.replace(/\s+/g, " ");
const sqlTest = readFileSync(SQL_TEST, "utf8");

const CONSENT_KEYS = ["clio_share_consent", "clio_share_consent_at", "updated_at"];
const REVOKE_KEYS = ["status", "revoked_at", "updated_at"];

function arrayConst(name: string): string[] {
  const m = flat.match(new RegExp(`${name} constant text\\[\\] := ARRAY\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`missing ${name}`);
  return m[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
}

function linkColumns(): string[] {
  const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const start = types.indexOf("attorney_client_links: {");
  const row = types.slice(types.indexOf("Row: {", start), types.indexOf("Insert: {", start));
  return [...row.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]).filter((c) => c !== "Row");
}

describe("attorney_client_links client update guard (C7 allowlist)", () => {
  it("is an allowlist over to_jsonb(row), not a hand-maintained ROW() column list", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()",
    );
    expect(flat).toContain("v_old := to_jsonb(OLD);");
    expect(flat).toContain("v_new := to_jsonb(NEW);");
    expect(flat).toContain("(v_new - c_consent_keys) = (v_old - c_consent_keys)");
    expect(flat).toContain("(v_new - c_revoke_keys) = (v_old - c_revoke_keys)");
    expect(flat).not.toMatch(/ROW\s*\(\s*NEW\./);
  });

  it("allows only the Clio consent fields and a one-way revoke", () => {
    expect(arrayConst("c_consent_keys").sort()).toEqual([...CONSENT_KEYS].sort());
    expect(arrayConst("c_revoke_keys").sort()).toEqual([...REVOKE_KEYS].sort());
    const revoke = flat.slice(
      flat.indexOf("(ii) One-way revoke"),
      flat.indexOf("(i) Clio consent"),
    );
    expect(revoke).toContain("NEW.status = 'revoked'");
    expect(revoke).toContain("OLD.revoked_at IS NULL");
    expect(revoke).toContain("NEW.revoked_at IS NOT NULL");
    // Server time wins over any client-supplied revoke timestamp (no backdating).
    expect(revoke).toMatch(/NEW\.revoked_at := now\(\); RETURN NEW;/);
    expect(flat).not.toMatch(/interval '5 minutes'/);
    // Any status/revoked_at change that is not that exact revoke is rejected,
    // never falls through to "RETURN NEW" (the old C7 bug).
    expect(revoke).toMatch(/END IF; RAISE EXCEPTION '[^']+' USING ERRCODE = '42501'; END IF;/);
  });

  it("rejects with 42501 and keeps the service_role bypass and non-client pass-through", () => {
    expect(flat.match(/ERRCODE = '42501'/g)?.length).toBe(2);
    expect(flat).toContain("v_uid uuid := auth.uid();");
    expect(flat).toContain(
      "IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.client_user_id THEN RETURN NEW;",
    );
  });

  it("has search_path hygiene, no SECURITY DEFINER, and the trigger stays attached", () => {
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("SECURITY INVOKER");
    expect(sql).not.toMatch(/SECURITY DEFINER\s*$/m);
    expect(flat).toContain(
      "DROP TRIGGER IF EXISTS attorney_client_links_client_update_guard ON public.attorney_client_links;",
    );
    expect(flat).toContain(
      "CREATE TRIGGER attorney_client_links_client_update_guard BEFORE UPDATE ON public.attorney_client_links FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();",
    );
  });

  it("is captured identically in the tracked drizzle migration 0008 + journal", () => {
    expect(readFileSync(DRIZZLE, "utf8")).toBe(sql);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags).toContain("0008_acl_client_update_guard_allowlist");
    expect(tags.indexOf("0008_acl_client_update_guard_allowlist")).toBeLessThan(tags.indexOf("0009_launch_consent_and_attorney_gate"));
  });

  it("the behavioural SQL test denies a survivor change to every non-allowlisted column", () => {
    const cols = linkColumns();
    expect(cols).toContain("expires_at");
    const allowed = new Set([...CONSENT_KEYS, ...REVOKE_KEYS]);
    // attorney_case_notes_updated_at is only written by its own trigger when
    // attorney_case_notes changes; covered via the attorney_case_notes case.
    const frozen = cols.filter((c) => !allowed.has(c) && c !== "attorney_case_notes_updated_at");
    const denied = [...sqlTest.matchAll(/expect_denied\([^;]*;/g)].map((m) => m[0]).join("\n");
    for (const col of frozen) expect(denied, `no denial case for ${col}`).toContain(col);
    for (const label of [
      "re-arm",
      "revoked_at -> NULL",
      "revoke + expires_at",
      "revoke + attorney_user_id swap",
      "revoke + Clio consent",
    ]) {
      expect(sqlTest).toContain(label);
    }
    expect(sqlTest).toContain("expect_allowed('one-way revoke");
    expect(sqlTest).toContain("revoked_at = '1970-01-01T00:00:00Z'");
    expect(sqlTest).toContain("revoked_at = now() + interval '1 year'");
    expect(sqlTest).toContain("ok   - stored revoked_at ~ now() for backdated input");
    expect(sqlTest).toContain("ok   - stored revoked_at ~ now() for future input");
    expect(sqlTest).toContain("expect_allowed('Clio consent on'");
    expect(sqlTest).toContain("expect_allowed('Clio consent off'");
    expect(sqlTest).toMatch(/^ROLLBACK;/m);
  });
});

/* Every write to attorney_client_links made with a user JWT must fit the guard. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !p.endsWith("integrations/supabase/types.ts"))
      out.push(p);
  }
  return out;
}

describe("user-JWT writers of attorney_client_links stay inside the guard allowlist", () => {
  const sites: Array<{ file: string; receiver: string; body: string }> = [];
  for (const file of walk("src")) {
    const src = readFileSync(file, "utf8");
    const re =
      /([\w.]+)\s*\.from\(\s*"attorney_client_links"\s*\)\s*\.(update|upsert)\(\s*\{([\s\S]*?)\}\s*\)/g;
    for (const m of src.matchAll(re)) sites.push({ file, receiver: m[1], body: m[3] });
  }

  it("finds the known write sites", () => {
    expect(sites.length).toBeGreaterThanOrEqual(8);
  });

  it("only context.supabase (user JWT) writes Clio consent; everything else is service-role", () => {
    const SERVICE = new Set(["supabaseAdmin", "admin", "db"]);
    for (const s of sites) {
      const file = s.file.replace(/\\/g, "/");
      if (s.receiver === "context.supabase") {
        // Object keys only (values like `data.consent ? … : null` are skipped).
        const written = [...s.body.matchAll(/(?:^|,|\{)\s*(\w+)\s*:/g)].map((k) => k[1]);
        expect(written.length).toBeGreaterThan(0);
        for (const k of written)
          expect([...CONSENT_KEYS, ...REVOKE_KEYS], `${file} writes ${k}`).toContain(k);
        continue;
      }
      if (s.receiver === "supabase") {
        // Must be a service-role client, never the browser client.
        const src = readFileSync(s.file, "utf8");
        expect(src, `${file} uses browser supabase client`).not.toMatch(
          /from\s+"@\/integrations\/supabase\/client"/,
        );
        expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
        continue;
      }
      expect(SERVICE.has(s.receiver), `${file}: unexpected receiver ${s.receiver}`).toBe(true);
    }
  });
});
