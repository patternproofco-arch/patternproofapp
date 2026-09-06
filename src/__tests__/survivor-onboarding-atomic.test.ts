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
const authenticatedLayout = readFileSync(
  new URL("../routes/_authenticated.tsx", import.meta.url),
  "utf8",
);

describe("survivor onboarding atomic finish", () => {
  it("exposes completeSurvivorOnboarding behind requireSupabaseAuth", () => {
    expect(legalConsent).toContain("export const completeSurvivorOnboarding");
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnHead = legalConsent.slice(fnStart, fnStart + 500);
    const fnBody = legalConsent.slice(fnStart);
    expect(fnHead).toContain("requireSupabaseAuth");
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


  it("gates forced metadata failure behind server env only (Guardian CLEAR)", () => {
    expect(legalConsent).toContain("isOnboardingForceMetaFailEnabled");
    expect(legalConsent).toContain('ONBOARDING_FORCE_META_FAIL === "1"');
    expect(legalConsent).toContain("onboardingForceMetaFailBlockReason");
    // Must not be flipable via request input / query params.
    const fnStart = legalConsent.indexOf("export const completeSurvivorOnboarding");
    const fnBody = legalConsent.slice(fnStart);
    expect(fnBody).not.toMatch(/forceMetaFail.*data\.|data\..*force|searchParams.*FORCE|query.*FORCE_META/i);
    // Production hard-deny BEFORE any write.
    expect(legalConsent).toMatch(/refused before any write/);
    expect(legalConsent).toContain("pk_live_");
    expect(legalConsent).toContain("pattern-proof.tech");
    // Force path still does terms insert first, then skips metadata write so
    // the real compensate-delete path runs (not an early return before insert).
    const insertAt = fnBody.indexOf('.from("user_terms_acceptance")');
    const forcedMsgAt = fnBody.indexOf("Forced onboarding metadata failure");
    const metaFailAt = fnBody.indexOf("if (metaError)");
    expect(insertAt).toBeGreaterThan(0);
    expect(forcedMsgAt).toBeGreaterThan(insertAt);
    expect(metaFailAt).toBeGreaterThan(forcedMsgAt);
    expect(fnBody).toContain("Compensate-delete should run");
    // Early prod hard-deny must appear before the terms insert write.
    const refusedAt = fnBody.indexOf("refused before any write");
    expect(refusedAt).toBeGreaterThan(0);
    expect(refusedAt).toBeLessThan(insertAt);
    // Auth-bound to context.userId only.
    expect(fnBody).toContain("context.userId");
    expect(fnBody).not.toMatch(/data\.userId|data\.user_id|targetUserId/);
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

describe("survivor onboarding gate", () => {
  it("fail-closes on server onboarding_complete, not local settings.onboarded alone", () => {
    expect(authenticatedLayout).toContain("onboarding_complete");
    expect(authenticatedLayout).toContain("onboardingComplete");
    // Redirect must not require !settings.onboarded (that skipped fresh signups
    // when localStorage still had onboarded=true from a prior account).
    expect(authenticatedLayout).toMatch(/!onboardingComplete && pathname !== "\/onboarding"/);
    expect(authenticatedLayout).not.toMatch(
      /!settings\.onboarded && pathname !== "\/onboarding"/,
    );
    // Must not render app shell while incomplete.
    expect(authenticatedLayout).toMatch(/Fail closed:[\s\S]*!onboardingComplete/);
  });
});
