import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { assertAssuranceForEnrolledAccount, MFA_REQUIRED_MESSAGE } from "@/lib/mfa-assurance.server";

const admin = (factors: Array<{ status: string }> | null, error: unknown = null) => {
  const listFactors = vi.fn(async () => ({ data: factors ? { factors } : null, error }));
  return { client: { auth: { admin: { mfa: { listFactors } } } }, listFactors };
};

describe("server: enrolled accounts need aal2 for record functions", () => {
  it("rejects aal1 when the user has a verified factor", async () => {
    const { client } = admin([{ status: "verified" }]);
    await expect(assertAssuranceForEnrolledAccount(client, "u1", { aal: "aal1" })).rejects.toThrow(MFA_REQUIRED_MESSAGE);
  });
  it("allows aal1 when the user has no verified factor", async () => {
    const { client } = admin([{ status: "unverified" }]);
    await expect(assertAssuranceForEnrolledAccount(client, "u1", { aal: "aal1" })).resolves.toBeUndefined();
    const none = admin([]);
    await expect(assertAssuranceForEnrolledAccount(none.client, "u1", { aal: "aal1" })).resolves.toBeUndefined();
  });
  it("allows aal2 without a lookup", async () => {
    const { client, listFactors } = admin([{ status: "verified" }]);
    await expect(assertAssuranceForEnrolledAccount(client, "u1", { aal: "aal2" })).resolves.toBeUndefined();
    expect(listFactors).not.toHaveBeenCalled();
  });
  it("fails closed when factors cannot be read", async () => {
    const { client } = admin(null, new Error("down"));
    await expect(assertAssuranceForEnrolledAccount(client, "u1", { aal: "aal1" })).rejects.toThrow(/Unauthorized/);
  });
  it("is wired into requireSupabaseAuth (all record server functions)", () => {
    const src = readFileSync("src/integrations/supabase/auth-middleware.ts", "utf8");
    const block = src.slice(src.indexOf("export const requireSupabaseAuth"));
    expect(block).toContain("assertAssuranceForEnrolledAccount");
  });
  it("code screen keeps Quick Exit and the survivor shell gates on MFA before mounting data", () => {
    const mfaSrc = readFileSync("src/routes/mfa.tsx", "utf8");
    // Quick Exit on both the loading state and the code form.
    expect(mfaSrc.split("<PublicQuickExit />").length - 1).toBeGreaterThanOrEqual(2);
    const layout = readFileSync("src/routes/_authenticated.tsx", "utf8");
    expect(layout).toContain("if (!portal || mfaChecking) return <Waiting />;");
  });
});
