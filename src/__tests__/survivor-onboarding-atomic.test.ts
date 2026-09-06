import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const legalConsent = readFileSync(
  new URL("../lib/legal-consent.functions.ts", import.meta.url),
  "utf8",
);
const onboardingPage = readFileSync(
  new URL("../routes/_authenticated/onboarding.tsx", import.meta.url),
  "utf8",
);

describe("survivor onboarding atomic finish", () => {
  it("exposes completeSurvivorOnboarding behind requireSupabaseAuth", () => {
    expect(legalConsent).toContain("export const completeSurvivorOnboarding");
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnBody = legalConsent.slice(fnStart, fnStart + 900);
    expect(fnBody).toContain("requireSupabaseAuth");
    expect(fnBody).toContain('account_type: "survivor"');
  });

  it("writes onboarding metadata via admin Auth API with context.userId", () => {
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnBody = legalConsent.slice(fnStart);
    expect(fnBody).toContain("auth.admin.updateUserById");
    expect(fnBody).toContain("context.userId");
    expect(fnBody).toContain("onboarding_complete: true");
    // Must not rely on the fragile client session for the metadata write.
    expect(fnBody).not.toContain("supabase.auth.updateUser");
  });

  it("compensates terms acceptance if metadata update fails", () => {
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnBody = legalConsent.slice(fnStart);
    const metaFailAt = fnBody.indexOf("if (metaError)");
    expect(metaFailAt).toBeGreaterThan(0);
    const compensate = fnBody.slice(metaFailAt, metaFailAt + 1200);
    expect(compensate).toContain('.from("user_terms_acceptance")');
    expect(compensate).toContain(".delete()");
    expect(compensate).toContain("deleteError");
    expect(compensate).toContain("deleteErrorMessage");
    expect(compensate).toContain("throw");
    expect(compensate).toMatch(/roll back terms acceptance|failed to roll back/i);
  });

  it("merges existing user_metadata before admin updateUserById", () => {
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnBody = legalConsent.slice(fnStart);
    expect(fnBody).toContain("getUserById");
    expect(fnBody).toContain("...existingMeta");
    expect(fnBody).toContain("user_metadata");
  });

  it("client finish path uses the atomic serverFn and not client updateUser", () => {
    expect(onboardingPage).toContain("completeSurvivorOnboarding");
    expect(onboardingPage).toContain("completeOnboarding");
    expect(onboardingPage).not.toContain("recordLegalAcceptance");
    expect(onboardingPage).not.toMatch(/supabase\.auth\.updateUser\s*\(/);
    expect(onboardingPage).toContain("getSession");
    expect(onboardingPage).toMatch(/session expired|sign in again/i);
  });
});
