/**
 * Attorney and collaborator case-file routes must fail closed: an
 * indeterminate two-step state denies the portal instead of rendering it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getUser = vi.fn();
const getAal = vi.fn();
const listFactors = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => getUser(),
      mfa: {
        getAuthenticatorAssuranceLevel: () => getAal(),
        listFactors: () => listFactors(),
      },
    },
  },
}));

import { resolveMfaGate } from "@/lib/mfa";

const REQUIRED = { requireEnrollment: true };

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { email: "counsel@examplefirm.test" } } });
  getAal.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
  listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] }, error: null });
});

describe("required MFA gate", () => {
  it("a. AAL1 with a verified factor is sent to the challenge", async () => {
    getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect(await resolveMfaGate(REQUIRED)).toBe("challenge");
  });

  it("b. no verified factor is sent to enrollment", async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1", status: "unverified" }] },
      error: null,
    });
    expect(await resolveMfaGate(REQUIRED)).toBe("enroll");
  });

  it("c. AAL2 with a verified factor opens the protected route", async () => {
    expect(await resolveMfaGate(REQUIRED)).toBe("allow");
  });

  it("d. an assurance-level lookup failure denies protected content", async () => {
    getAal.mockResolvedValue({ data: null, error: { message: "network" } });
    expect(await resolveMfaGate(REQUIRED)).toBe("deny");

    getAal.mockRejectedValue(new Error("offline"));
    expect(await resolveMfaGate(REQUIRED)).toBe("deny");
  });

  it("e. a factor lookup failure denies protected content", async () => {
    listFactors.mockResolvedValue({ data: null, error: { message: "network" } });
    expect(await resolveMfaGate(REQUIRED)).toBe("deny");

    listFactors.mockRejectedValue(new Error("offline"));
    expect(await resolveMfaGate(REQUIRED)).toBe("deny");
  });

  it("never denies non-required routes, but still challenges them", async () => {
    getAal.mockResolvedValue({ data: null, error: { message: "network" } });
    expect(await resolveMfaGate({})).toBe("allow");
    getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect(await resolveMfaGate({})).toBe("challenge");
  });
});

describe("f. attorney and collaborator routes use the fail-closed gate", () => {
  const hook = readFileSync("src/hooks/use-mfa-gate.ts", "utf8");
  const attorney = readFileSync("src/routes/_attorney.tsx", "utf8");

  it("the hook routes each decision correctly and exposes a denied state", () => {
    expect(hook).toContain("resolveMfaGate");
    expect(hook).toContain('decision === "challenge"');
    expect(hook).toContain('to: "/mfa"');
    expect(hook).toContain('decision === "enroll"');
    expect(hook).toContain("enrollTo");
    expect(hook).toContain('decision === "deny"');
    expect(hook).toContain("setDenied(true)");
    // No silent open on error for required routes.
    expect(hook).toContain("setDenied(requireEnrollment)");
  });

  it("the attorney/collaborator layout requires enrollment and blocks on denial", () => {
    expect(attorney).toContain("requireEnrollment: true");
    expect(attorney).toContain("mfaGate.denied");
    expect(attorney).toContain("if (mfaDenied) {");
    // The denial screen must return before the portal shell renders.
    expect(attorney.indexOf("if (mfaDenied) {")).toBeLessThan(
      attorney.indexOf('className="att-root att-cockpit att-shell"'),
    );
  });

  it("keeps enrollment, trust, setup and billing reachable", () => {
    const mfa = readFileSync("src/lib/mfa.ts", "utf8");
    for (const p of ["/subscribe", "/billing-return", "/setup", "/billing", "/trust", "/two-factor"]) {
      expect(mfa).toContain(`pathname === "${p}"`);
    }
    expect(attorney).toContain("attorneyPathExemptFromRequiredMfa(pathname)");
  });
});


describe("production test identities have no authorization bypass", () => {
  const formerTestEmails = [
    "attorneyppme@yahoo.com",
    "advocateppme@gmail.com",
    "survivorppme@gmail.com",
    "savinggrace.homereset@gmail.com",
  ];

  it.each(formerTestEmails)("%s receives the normal required MFA challenge", async (email) => {
    getUser.mockResolvedValue({ data: { user: { email } } });
    getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect(await resolveMfaGate(REQUIRED)).toBe("challenge");
  });

  it("contains no production test-account helper or imports", () => {
    const productionFiles = [
      "src/lib/mfa.ts",
      "src/hooks/useSubscription.ts",
      "src/routes/_authenticated.tsx",
      "src/routes/_advocate.tsx",
      "src/routes/_attorney.tsx",
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(productionFiles).not.toContain("test-accounts");
    expect(productionFiles).not.toContain("isTestAccountEmail");
    expect(productionFiles).not.toContain("testAccountRole");
  });
});
