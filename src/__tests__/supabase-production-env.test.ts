import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * After issue #59, real secrets must never live in git.
 * This suite guards soft-claim production hygiene:
 * - no committed .env / .env.production
 * - .env.example documents browser-safe key *names* only
 * - no privileged key names in example or public Vite config
 */
const exampleEnv = readFileSync(".env.example", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("production Supabase environment", () => {
  it("does not commit real env files to the repo tip", () => {
    expect(existsSync(".env")).toBe(false);
    expect(existsSync(".env.production")).toBe(false);
  });

  it("documents browser-safe Supabase key names in .env.example (empty values)", () => {
    expect(exampleEnv).toMatch(/VITE_SUPABASE_URL=/);
    expect(exampleEnv).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY=/);
    expect(exampleEnv).toMatch(/VITE_SUPABASE_PROJECT_ID=/);
    // Example values must stay empty / placeholder — no live project URL or JWT in git.
    for (const line of exampleEnv.split(/\r?\n/)) {
      if (!line.startsWith("VITE_SUPABASE_")) continue;
      const value = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
      expect(value).toBe("");
    }
  });

  it("keeps supabase/config.toml project_id present for local tooling", () => {
    expect(supabaseConfig).toMatch(/project_id\s*=\s*"[a-z0-9]+"/);
  });

  it("never documents privileged Supabase credentials for the browser", () => {
    expect(exampleEnv).not.toMatch(/SERVICE_ROLE/i);
    expect(exampleEnv).not.toMatch(/SECRET_KEY/i);
    expect(exampleEnv).not.toMatch(/service_role/i);
  });
});
