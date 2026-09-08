import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const orgFns = readFileSync("src/lib/org-portal.functions.ts", "utf8");
const orgSignup = readFileSync("src/routes/org-signup.tsx", "utf8");
const invitePage = readFileSync("src/routes/advocate-survivor-invite.$token.tsx", "utf8");

describe("partner organizations stay invitation-only", () => {
  it("setMyOrg refuses accounts without an approved access request", () => {
    expect(orgFns).toContain("if (!approved) throw new Error(NOT_APPROVED_MESSAGE);");
  });

  it("eligibility is keyed to a verified account email", () => {
    expect(orgFns).toContain("const email = await verifiedAccountEmail(userId);");
    expect(orgFns).toContain('.eq("status", "approved")');
  });

  it("uses only the statuses the database trigger allows", () => {
    expect(orgFns).not.toContain('"provisioned"');
    expect(orgFns).toContain('z.enum(["approved", "denied", "pending"])');
  });

  it("signup shows a pending state instead of bouncing back to the portal", () => {
    expect(orgSignup).toContain('setStep("pending")');
    expect(orgSignup).toContain("We&apos;re verifying your organization");
  });
});

describe("advocate → survivor invite requires survivor onboarding first", () => {
  it("gates the consent step on onboarding_complete, failing closed", () => {
    expect(invitePage).toContain("onboarding_complete?: boolean");
    expect(invitePage).toContain("setNeedsWelcome(!onboardingDone)");
  });

  it("hides the Accept & share control until onboarding is finished", () => {
    const gateIndex = invitePage.indexOf("{needsWelcome ? (");
    const acceptIndex = invitePage.indexOf("Accept & share");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(acceptIndex).toBeGreaterThan(gateIndex);
    expect(invitePage).toContain('sessionStorage.setItem("pp_return_to"');
  });
});
