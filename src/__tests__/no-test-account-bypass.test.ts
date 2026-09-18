import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Release blocker regression: no email address may bypass MFA, role
 * authorization, onboarding or subscription enforcement in production code.
 */

const QA_EMAILS = [
  "attorneyppme@yahoo.com",
  "advocateppme@gmail.com",
  "survivorppme@gmail.com",
  "savinggrace.homereset@gmail.com",
];

const mfaState = {
  aal: { currentLevel: "aal1", nextLevel: "aal2" },
  factors: { totp: [] as Array<{ id: string; status: string }> },
  email: "" as string,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "u1", email: mfaState.email } } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: mfaState.aal, error: null }),
        listFactors: async () => ({ data: mfaState.factors, error: null }),
        unenroll: async () => ({ data: null, error: null }),
      },
    },
  },
}));

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      sourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("no production test-account bypass", () => {
  const files = sourceFiles("src");

  it("no production source file references the QA email addresses", () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, "utf8").toLowerCase();
      return QA_EMAILS.some((e) => text.includes(e));
    });
    expect(offenders).toEqual([]);
  });

  it("the test-accounts bypass module no longer exists or is imported", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("test-accounts"));
    expect(offenders).toEqual([]);
    expect(() => statSync("src/lib/test-accounts.ts")).toThrow();
  });

  it("no source file branches on a hardcoded email allowlist", () => {
    const offenders = files.filter((f) => /isTestAccountEmail|testAccountRole/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("MFA enforcement is identical for the QA accounts", () => {
  beforeEach(() => {
    mfaState.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    mfaState.factors = { totp: [] };
  });

  for (const email of QA_EMAILS) {
    it(`${email} is still challenged when the session is AAL1 with a verified factor`, async () => {
      const { sessionNeedsMfa } = await import("@/lib/mfa");
      mfaState.email = email;
      mfaState.factors = { totp: [{ id: "f1", status: "verified" }] };
      await expect(sessionNeedsMfa()).resolves.toBe(true);
    });

    it(`${email} is still treated as un-enrolled with no verified factor`, async () => {
      const { hasVerifiedTotp } = await import("@/lib/mfa");
      mfaState.email = email;
      mfaState.factors = { totp: [{ id: "f1", status: "unverified" }] };
      await expect(hasVerifiedTotp()).resolves.toBe(false);
    });

    it(`${email} clears the challenge only by reaching AAL2`, async () => {
      const { sessionNeedsMfa } = await import("@/lib/mfa");
      mfaState.email = email;
      mfaState.aal = { currentLevel: "aal2", nextLevel: "aal2" };
      await expect(sessionNeedsMfa()).resolves.toBe(false);
    });
  }
});
