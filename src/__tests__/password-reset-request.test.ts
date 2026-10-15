import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RESET_NETWORK,
  RESET_RATE_LIMITED,
  RESET_SEND_FAILED,
  classifyResetResult,
  resetDiagnostics,
} from "@/lib/password-reset-request";

describe("forgot-password outcome", () => {
  it("shows success only when Auth returned no error", () => {
    expect(classifyResetResult(null)).toEqual({ kind: "sent" });
    expect(classifyResetResult(undefined)).toEqual({ kind: "sent" });
  });

  it("any error is a calm, retry-able error — never the success screen", () => {
    for (const err of [
      { message: "Error sending recovery email", status: 500, code: "unexpected_failure" },
      { message: "captcha verification process failed", status: 400, code: "captcha_failed" },
      { message: "Hook timed out", status: 500 },
      { message: "Email address is invalid", status: 400, code: "email_address_invalid" },
      { message: "Something new and unexpected" },
      { message: "" },
    ]) {
      const o = classifyResetResult(err);
      expect(o.kind).toBe("error");
      if (o.kind === "error") expect(o.message).toBe(RESET_SEND_FAILED);
    }
  });

  it("rate limit and network failures get their own calm copy", () => {
    expect(
      classifyResetResult({ message: "x", status: 429, code: "over_email_send_rate_limit" }),
    ).toMatchObject({ message: RESET_RATE_LIMITED });
    expect(
      classifyResetResult({ message: "For security purposes, too many requests" }),
    ).toMatchObject({ message: RESET_RATE_LIMITED });
    expect(classifyResetResult({ message: "Failed to fetch" })).toMatchObject({
      message: RESET_NETWORK,
    });
  });

  it("messages never reveal whether an account exists", () => {
    for (const m of [RESET_SEND_FAILED, RESET_RATE_LIMITED, RESET_NETWORK]) {
      expect(m).not.toMatch(/no account|not found|not registered|doesn't exist|unknown/i);
    }
  });

  it("diagnostics carry status and code only, never email or server text", () => {
    const o = classifyResetResult({
      message: "Error sending recovery email to someone@example.com",
      status: 500,
      code: "unexpected_failure",
    });
    const line = resetDiagnostics(o)!;
    expect(line).toBe("[password-reset] not sent: status=500 code=unexpected_failure");
    expect(line).not.toMatch(/@|example|sending/);
    // A code that isn't a plain identifier is not echoed.
    const odd = resetDiagnostics(classifyResetResult({ message: "x", code: "a@b.c" }))!;
    expect(odd).toContain("code=unknown");
    expect(resetDiagnostics({ kind: "sent" })).toBeNull();
  });

  it("the page uses the classifier, keeps the email typed for retry, and keeps Quick Exit", () => {
    const src = readFileSync("src/routes/forgot-password.tsx", "utf8");
    expect(src).toContain("classifyResetResult(resetError)");
    expect(src).not.toMatch(/Other API responses .* calm success/);
    expect(src).toMatch(
      /if \(outcome\.kind === "error"\) \{[\s\S]*?setError\(outcome\.message\);\s*return;/,
    );
    expect(src).toContain("<PublicQuickExit />");
  });
});
