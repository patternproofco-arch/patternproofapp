import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const roleRow: { value: unknown } = { value: null };
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: roleRow.value, error: null }),
  };
  return { supabaseAdmin: { from: () => chain } };
});

const src = readFileSync("src/lib/founder-ops.functions.ts", "utf8");
const panel = readFileSync("src/components/admin/AttorneyRequestsPanel.tsx", "utf8");
const page = readFileSync("src/routes/_authenticated/admin.index.tsx", "utf8");

describe("founder-ops server functions (merged from Lovable)", () => {
  it("every server function is signed-in and checks admin on the server", () => {
    const fns = src.split("createServerFn(").slice(1);
    expect(fns.length).toBe(3);
    for (const body of fns) {
      expect(body).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
      expect(body).toMatch(/await assertFounderAdmin\(context\.userId\)/);
    }
  });

  it("checks the role with the service-role client, not a browser flag", () => {
    const fn = src.slice(src.indexOf("export async function assertFounderAdmin"));
    expect(fn).toContain('import("@/integrations/supabase/client.server")');
    expect(fn).toMatch(/\.eq\("role", "admin"\)/);
    for (const ui of [panel, page]) {
      expect(ui).not.toMatch(/isAdmin|role ===|roles\.includes\(/);
    }
  });

  it("has no public submit endpoint and no logging of emails or names", () => {
    expect(src).not.toContain("submitAttorneyApplication");
    expect(src).not.toMatch(/console\.(log|info|warn|error|debug)/);
    expect(panel).not.toMatch(/console\./);
  });

  it("sends approved attorneys into main's bar review, not straight to sign-in", () => {
    expect(src).toContain("redirectTo: `${SITE}/attorney-apply`");
  });
});

describe("assertFounderAdmin", () => {
  beforeEach(() => {
    roleRow.value = null;
  });
  it("rejects a user without the admin role", async () => {
    const { assertFounderAdmin } = await import("@/lib/founder-ops.functions");
    await expect(assertFounderAdmin("00000000-0000-4000-8000-000000000001")).rejects.toThrow(
      "This page is for PatternProof staff.",
    );
  });
  it("allows an admin", async () => {
    roleRow.value = { role: "admin" };
    const { assertFounderAdmin } = await import("@/lib/founder-ops.functions");
    await expect(assertFounderAdmin("00000000-0000-4000-8000-000000000002")).resolves.toBeTruthy();
  });
});
