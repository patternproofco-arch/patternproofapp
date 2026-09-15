import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const envTemplate = readFileSync(".env.example", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("production Supabase environment", () => {
  it("documents every browser-safe value the build must inject", () => {
    expect(envTemplate).toContain("VITE_SUPABASE_URL=");
    expect(envTemplate).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
    expect(envTemplate).toContain("VITE_SUPABASE_PROJECT_ID=");
  });

  it("commits a valid Supabase project reference", () => {
    expect(supabaseConfig).toMatch(/project_id = "[a-z0-9]+"/);
  });

  it("never exposes privileged Supabase credentials to the browser", () => {
    expect(envTemplate).not.toMatch(/^VITE_.*(?:SERVICE_ROLE|SECRET_KEY)/m);
  });
});
