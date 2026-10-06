import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTH_EMAIL_FROM_DISPLAY,
  RECOVERY_EMAIL_INBOX_HINT,
  RECOVERY_EMAIL_SUBJECT,
} from "@/lib/email-templates/recovery.config";
import {
  CANONICAL_PRODUCTION_ORIGIN,
  PASSWORD_RECOVERY_PATH,
  passwordRecoveryRedirectTo,
} from "@/lib/password-recovery-redirect";

const recovery = readFileSync("src/lib/email-templates/recovery.tsx", "utf8");
const webhook = readFileSync("src/routes/lovable/email/auth/webhook.ts", "utf8");
const forgot = readFileSync("src/routes/forgot-password.tsx", "utf8");
const reset = readFileSync("src/routes/reset-password.tsx", "utf8");

const BANNED_INBOX = [/PatternProof/i, /\bCourt\b/, /\bDV\b/, /survivor/i];

describe("passwordRecoveryRedirectTo", () => {
  it("forces apex https for production and www hosts", () => {
    const expected = `${CANONICAL_PRODUCTION_ORIGIN}${PASSWORD_RECOVERY_PATH}`;
    expect(passwordRecoveryRedirectTo("https://pattern-proof.tech")).toBe(expected);
    expect(passwordRecoveryRedirectTo("https://www.pattern-proof.tech")).toBe(expected);
    expect(passwordRecoveryRedirectTo("http://pattern-proof.tech")).toBe(expected);
    expect(passwordRecoveryRedirectTo("https://www.pattern-proof.tech/forgot-password")).toBe(
      expected,
    );
  });

  it("preserves lovable preview origins", () => {
    expect(passwordRecoveryRedirectTo("https://pattern-proofapp.lovable.app")).toBe(
      `https://pattern-proofapp.lovable.app${PASSWORD_RECOVERY_PATH}`,
    );
  });
});

describe("survivor-safe recovery email labels", () => {
  it("keeps subject and from display free of product / court / DV / survivor wording", () => {
    expect(RECOVERY_EMAIL_SUBJECT).toBe("Your account access link");
    expect(AUTH_EMAIL_FROM_DISPLAY).toBe("Account Notices");
    for (const re of BANNED_INBOX) {
      expect(RECOVERY_EMAIL_SUBJECT).not.toMatch(re);
      expect(AUTH_EMAIL_FROM_DISPLAY).not.toMatch(re);
    }
    expect(RECOVERY_EMAIL_SUBJECT.toLowerCase()).not.toContain("reset your password");
  });

  it("wires subject and from into the Lovable auth webhook", () => {
    expect(webhook).toContain("RECOVERY_EMAIL_SUBJECT");
    expect(webhook).toContain("AUTH_EMAIL_FROM_DISPLAY");
    expect(webhook).not.toMatch(/subject:\s*'Reset your password'/);
    expect(webhook).not.toMatch(/from:\s*`Pattern-proof </);
  });

  it("keeps the recovery HTML body free of PatternProof wordmark and banned inbox terms", () => {
    expect(recovery).not.toContain("PatternProof");
    expect(recovery).not.toMatch(/wordmark/);
    for (const re of BANNED_INBOX) {
      expect(recovery).not.toMatch(re);
    }
    expect(recovery).toContain("Account access");
    expect(recovery).toContain("Continue");
  });
});

describe("forgot / reset quiet chrome and send trust", () => {
  it("uses quiet document titles without PatternProof", () => {
    expect(forgot).toContain('{ title: "Account access" }');
    expect(reset).toContain('{ title: "Update account" }');
    expect(forgot).not.toMatch(/title: "PatternProof/);
    expect(reset).not.toMatch(/title: "PatternProof/);
  });

  it("uses the canonical redirect helper and surfaces send-config failures", () => {
    expect(forgot).toContain("passwordRecoveryRedirectTo");
    expect(forgot).toContain("We couldn't send a reset link right now");
    expect(forgot).toContain("RECOVERY_EMAIL_INBOX_HINT");
    expect(RECOVERY_EMAIL_INBOX_HINT).toMatch(/Your account access link/);
    expect(RECOVERY_EMAIL_INBOX_HINT).toMatch(/Account Notices/);
  });
});
