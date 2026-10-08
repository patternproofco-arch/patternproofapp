import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANON_TABLE_GRANTS,
  NOT_ANON,
  PUBLIC_FILES_SIGNED_IN_ONLY,
} from "@/lib/anon-access-inventory";

/*
 * Guardian real-data gate: anon gets nothing in schema public except the
 * inventoried grants. Static contract for
 * supabase/migrations/20261008130000_anon_revoke_all_default_privileges.sql.
 * Behavioural run: scripts/run-anon-revoke-sql-test.mjs (PGlite).
 */

const MIGRATION = "supabase/migrations/20261008130000_anon_revoke_all_default_privileges.sql";
const DRIZZLE = "drizzle/migrations/0009_anon_revoke_all_default_privileges.sql";
const sql = readFileSync(MIGRATION, "utf8");
/** SQL statements without comments, whitespace collapsed. */
const code = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

describe("anon migration matches the inventory", () => {
  it("re-grants exactly the inventoried anon privileges, nothing else", () => {
    const grants = [...code.matchAll(/GRANT ([A-Z, ]+?) ON TABLE public\.(\w+) TO anon;/g)].map(
      (m) => ({
        table: m[2],
        privileges: m[1]
          .split(",")
          .map((p) => p.trim())
          .sort(),
      }),
    );
    const expected = ANON_TABLE_GRANTS.map((g) => ({
      table: g.table,
      privileges: [...g.privileges].sort(),
    }));
    expect(grants).toEqual(expected);
    // No other GRANT ... TO anon in any form (column-level, sequences, functions).
    expect(code.match(/GRANT [^;]*TO anon/g)?.length).toBe(expected.length);
    expect(ANON_TABLE_GRANTS.every((g) => !g.columns)).toBe(true);
  });

  it("revokes everything from anon and closes default privileges", () => {
    expect(code).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;");
    expect(code).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;");
    expect(code).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;",
    );
    expect(code).toContain(
      "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;",
    );
    // Other owners + supabase_admin, skipped with a NOTICE when not permitted.
    expect(code).toContain("SELECT rolname FROM pg_roles WHERE rolname = 'supabase_admin'");
    expect(code).toContain("EXCEPTION WHEN insufficient_privilege THEN");
    // Revoke comes before the re-grant.
    expect(code.indexOf("REVOKE ALL ON ALL TABLES")).toBeLessThan(code.indexOf("GRANT INSERT"));
  });

  it("never grants to PUBLIC and never touches authenticated / service_role / RLS / functions", () => {
    expect(code).not.toMatch(/TO PUBLIC/i);
    expect(code).not.toMatch(/\b(authenticated|service_role)\b/);
    expect(code).not.toMatch(/POLICY|ROW LEVEL SECURITY/i);
    expect(code).not.toMatch(/ON (ALL )?FUNCTIONS?\b/i);
  });

  it("is captured identically as tracked drizzle migration 0009", () => {
    expect(readFileSync(DRIZZLE, "utf8")).toBe(sql);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    expect(tags[tags.length - 1]).toBe("0009_anon_revoke_all_default_privileges");
  });
});

describe("inventory matches the code", () => {
  const files = walk("src");
  const BROWSER = /from\s+"@\/integrations\/supabase\/client"/;
  const SIGNED_IN_GROUP = /^src\/routes\/(_authenticated|_attorney|_advocate)(\/|\.tsx$)/;

  it("every inventoried call site exists and really writes that table", () => {
    for (const g of ANON_TABLE_GRANTS) {
      for (const f of g.callSites) {
        const src = readFileSync(f, "utf8");
        expect(src, f).toMatch(BROWSER);
        expect(src, f).toMatch(new RegExp(`\\.from\\(\\s*"${g.table}"\\s*\\)\\s*\\.insert\\(`));
        // insert without .select(): anon has no SELECT.
        const after = src.slice(src.indexOf(`.from("${g.table}")`)).split(";")[0];
        expect(after, `${f} must not read back the row`).not.toMatch(/\.select\(/);
      }
    }
    for (const n of NOT_ANON) for (const f of n.callSites) expect(files).toContain(f);
  });

  it("public (signed-out) routes only use the browser client for inventoried anon grants", () => {
    const allowed = new Set(
      ANON_TABLE_GRANTS.flatMap((g) => g.privileges.map((p) => `${g.table}:${p}`)),
    );
    for (const f of files) {
      if (!f.startsWith("src/routes/") || SIGNED_IN_GROUP.test(f)) continue;
      const src = readFileSync(f, "utf8");
      if (!BROWSER.test(src)) continue;
      if (PUBLIC_FILES_SIGNED_IN_ONLY.includes(f)) continue;
      expect(src, `${f}: browser rpc as anon`).not.toMatch(/supabase\s*\.rpc\(/);
      for (const m of src.matchAll(
        /supabase\s*\.from\(\s*"(\w+)"\s*\)\s*\.(select|insert|update|upsert|delete)\(/g,
      )) {
        const op = m[2] === "upsert" ? "INSERT" : m[2].toUpperCase();
        expect(allowed.has(`${m[1]}:${op}`), `${f}: anon ${op} ${m[1]} not in inventory`).toBe(
          true,
        );
      }
    }
  });

  it("signed-in-only public files really gate their table calls on a user", () => {
    for (const f of PUBLIC_FILES_SIGNED_IN_ONLY) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("useAuth");
      expect(src).toMatch(/if \(!user[^)]*\) return;/);
      expect(src).toMatch(/\.eq\("user_id", user\.id\)/);
    }
  });

  it("server code using the publishable (anon) key only does auth calls or forwards a user JWT", () => {
    const KNOWN = new Set([
      "src/integrations/supabase/auth-middleware.ts", // user JWT -> authenticated
      "src/routes/api/chat.ts", // user JWT -> authenticated
      "src/lib/mcp/supabase.ts", // user token -> authenticated
      "src/lib/support.functions.ts", // auth.getUser only; writes via supabaseAdmin
      "src/lib/pin-lock.functions.ts", // auth.signInWithPassword only
    ]);
    const found = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        /createClient(<[^>]+>)?\(/.test(src) && /process\.env\.SUPABASE_PUBLISHABLE_KEY/.test(src)
      );
    });
    expect(found.sort()).toEqual([...KNOWN].sort());
  });
});
