import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionEnv = readFileSync(".env", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

const env = Object.fromEntries(
  productionEnv
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

describe("production Supabase environment", () => {
  it("commits the browser-safe values Lovable requires at build time", () => {
    expect(env.VITE_SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(env.VITE_SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_/);
    expect(env.VITE_SUPABASE_PROJECT_ID).toMatch(/^[a-z0-9]+$/);
  });

  it("keeps the project reference consistent", () => {
    expect(env.VITE_SUPABASE_URL).toContain(env.VITE_SUPABASE_PROJECT_ID);
    expect(supabaseConfig).toContain(`project_id = "${env.VITE_SUPABASE_PROJECT_ID}"`);
  });

  it("never exposes privileged Supabase credentials to the browser", () => {
    expect(productionEnv).not.toContain("SERVICE_ROLE");
    expect(productionEnv).not.toContain("SECRET_KEY");
  });
});
