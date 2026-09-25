import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Tip hygiene for #59: tracked sources must not embed production Supabase
 * publishable keys or silent OR-fallbacks that revive exposed credentials.
 */
const viteConfig = readFileSync("vite.config.ts", "utf8");
const mockSession = readFileSync("scripts/qa/mock-session.mjs", "utf8");
// The Vite MCP plugin regenerates this tracked manifest during a test run.
// Check the committed copy, so a locally generated issuer cannot create a
// false failure or hide a hardcoded host in the source revision under review.
const mcpManifest = execFileSync("git", ["show", "HEAD:.lovable/mcp/manifest.json"], {
  encoding: "utf8",
});
const mcpSource = readFileSync("src/lib/mcp/index.ts", "utf8");

describe("no hardcoded production credentials in tip", () => {
  it("vite.config.ts fails closed via requiredBuildEnv (no OR-fallbacks)", () => {
    expect(viteConfig).toMatch(/function requiredBuildEnv/);
    expect(viteConfig).toMatch(/Missing required build environment variable/);
    expect(viteConfig).not.toMatch(/\|\|\s*["']https:\/\/[a-z0-9]+\.supabase\.co/);
    expect(viteConfig).not.toMatch(/sb_publishable_/);
    expect(viteConfig).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("QA mock session does not default to a production Supabase host", () => {
    expect(mockSession).not.toMatch(/https:\/\/[a-z0-9]{15,}\.supabase\.co/);
    expect(mockSession).toMatch(/ci-placeholder/);
  });

  it("Lovable MCP manifest issuer is not a live project host", () => {
    expect(mcpManifest).toMatch(/example\.supabase\.co/);
    expect(mcpManifest).not.toMatch(/https:\/\/[a-z0-9]{15,}\.supabase\.co/);
    expect(mcpSource).toMatch(/import\.meta\.env\.VITE_SUPABASE_PROJECT_ID/);
    expect(mcpSource).not.toMatch(/https:\/\/[a-z0-9]{15,}\.supabase\.co/);
  });
});
