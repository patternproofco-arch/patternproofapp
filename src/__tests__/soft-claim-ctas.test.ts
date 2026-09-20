import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const attorneys = readFileSync("src/routes/for-attorneys.tsx", "utf8");
const orgs = readFileSync("src/routes/for-organizations.tsx", "utf8");
const safety = readFileSync("src/routes/safety.tsx", "utf8");
const forgot = readFileSync("src/routes/forgot-password.tsx", "utf8");
const reset = readFileSync("src/routes/reset-password.tsx", "utf8");

function collapsed(s: string): string {
  return s.replace(/\s+/g, " ");
}

describe("soft-claim professional CTAs", () => {
  it("labels For Attorneys as invitation-only via G. BURNS COMPANY LLC", () => {
    const text = collapsed(attorneys);
    expect(text).toContain("G. BURNS COMPANY LLC");
    expect(text).toContain(
      "Invitation-only. Request access through G. BURNS COMPANY LLC. Paying does not unlock access — verification does.",
    );
    expect(attorneys).not.toMatch(/passkey/i);
    expect(attorneys).not.toContain("Create an attorney account");
    expect(attorneys).not.toContain("Open one client share free");
  });

  it("labels For Organizations as invitation-only partner review via G. BURNS COMPANY LLC", () => {
    const text = collapsed(orgs);
    expect(text).toContain("G. BURNS COMPANY LLC");
    expect(text).toContain("Invitation-only partner review via G. BURNS COMPANY LLC.");
    expect(text).toContain("Organizations partner at no cost after verification.");
    expect(text).toContain("Survivors choose what to share.");
    expect(orgs).not.toMatch(/passkey/i);
    expect(orgs).not.toMatch(/safer than notes/i);
  });

  it("removes passkey claims from the public safety page", () => {
    expect(safety).not.toMatch(/passkey/i);
  });
});

describe("forgot / reset password soft-claim UX", () => {
  it("keeps forgot-password enumeration-safe with visible alerts", () => {
    expect(forgot).toContain("We do not confirm here whether an account exists");
    expect(forgot).toContain('role="alert"');
    expect(forgot).toContain("resetPasswordForEmail");
  });

  it("surfaces reset-password errors with role=alert", () => {
    expect(reset).toContain('role="alert"');
    expect(reset).toContain('data-testid="reset-password-error"');
  });
});
