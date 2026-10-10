import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Tip hygiene for #59: tracked sources must not embed production Supabase
 * publishable keys or silent OR-fallbacks that revive exposed credentials.
 */
const viteConfig = readFileSync("vite.config.ts", "utf8");
const mockSession = readFileSync("scripts/qa/mock-session.mjs", "utf8");
const mcpManifest = readFileSync(".lovable/mcp/manifest.json", "utf8");

/** Approved live auth host for PatternProof (muy). OAuth issuer URLs are public. */
const APPROVED_MCP_ISSUER = "https://muynotmkcmehxnkhffzl.supabase.co/auth/v1";

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
    expect(mockSession).toMatch(/ci-placeholder|example\.invalid/);
  });

  it("Lovable MCP manifest issuer is placeholder or the approved muy host only", () => {
    const issuer = (JSON.parse(mcpManifest) as { auth?: { issuer?: string } }).auth?.issuer ?? "";
    const ok = issuer === "https://example.supabase.co/auth/v1" || issuer === APPROVED_MCP_ISSUER;
    expect(ok).toBe(true);
    // Reject other live project hosts (obljoe, preview, etc.).
    expect(issuer).not.toMatch(/obljoe|xislyfqrcfpwtzonyhcr/);
  });
});
