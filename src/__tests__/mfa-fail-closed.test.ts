import { beforeEach, describe, expect, it, vi } from "vitest";

type Aal = { currentLevel: string; nextLevel: string };

const mfa: {
  aal: { data: Aal | null; error: { message: string } | null };
  factors: {
    data: { totp: Array<{ id: string; status: string }> } | null;
    error: { message: string } | null;
  };
} = {
  aal: { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null },
  factors: { data: { totp: [] }, error: null },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => mfa.aal,
        listFactors: async () => mfa.factors,
      },
    },
  },
}));

describe("resolveMfaGate fail-closed", () => {
  beforeEach(() => {
    mfa.aal = { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null };
    mfa.factors = { data: { totp: [] }, error: null };
  });

  it("denies when requireEnrollment and AAL lookup errors", async () => {
    const { resolveMfaGate } = await import("@/lib/mfa");
    mfa.aal = { data: null, error: { message: "blocked" } };
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("deny");
  });

  it("denies when requireEnrollment and listFactors errors", async () => {
    const { resolveMfaGate } = await import("@/lib/mfa");
    mfa.factors = { data: null, error: { message: "blocked" } };
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("deny");
  });

  it("enrolls only when listFactors succeeds with no verified factor", async () => {
    const { resolveMfaGate } = await import("@/lib/mfa");
    mfa.factors = { data: { totp: [] }, error: null };
    await expect(resolveMfaGate({ requireEnrollment: true })).resolves.toBe("enroll");
  });

  it("totpStatus returns unknown on listFactors error", async () => {
    const { totpStatus } = await import("@/lib/mfa");
    mfa.factors = { data: null, error: { message: "blocked" } };
    await expect(totpStatus()).resolves.toBe("unknown");
  });

  it("attorneyPathWithoutPortalChrome covers trust and two-factor", async () => {
    const { attorneyPathWithoutPortalChrome } = await import("@/lib/mfa");
    expect(attorneyPathWithoutPortalChrome("/trust")).toBe(true);
    expect(attorneyPathWithoutPortalChrome("/two-factor")).toBe(true);
    expect(attorneyPathWithoutPortalChrome("/clients")).toBe(false);
  });
});
