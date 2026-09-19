import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatAuthError, formatSignupNoSession } from "@/lib/auth-errors";

describe("formatAuthError", () => {
  it("maps invalid credentials for login", () => {
    expect(formatAuthError(new Error("Invalid login credentials"), "login")).toBe(
      "That email or password doesn't match. Check both and try again.",
    );
  });

  it("maps network failures", () => {
    expect(formatAuthError(new Error("Failed to fetch"), "login")).toMatch(/reach the sign-in/);
    expect(
      formatAuthError(new Error("NetworkError when attempting to fetch resource."), "signup"),
    ).toMatch(/reach the sign-in/);
  });

  it("maps email not confirmed", () => {
    expect(formatAuthError(new Error("Email not confirmed"), "login")).toMatch(
      /Confirm your email/,
    );
  });

  it("maps already registered for signup", () => {
    expect(formatAuthError(new Error("User already registered"), "signup")).toMatch(
      /already has an account/,
    );
  });

  it("falls back with mode prefix when message is unknown", () => {
    expect(formatAuthError(new Error("weird upstream"), "login")).toBe(
      "We couldn't sign you in. weird upstream",
    );
    expect(formatAuthError(new Error("weird upstream"), "signup")).toBe(
      "We couldn't create your account. weird upstream",
    );
  });

  it("handles non-Error objects with message", () => {
    expect(formatAuthError({ message: "Invalid login credentials" }, "login")).toMatch(
      /doesn't match/,
    );
  });

  it("handles empty unknown errors", () => {
    expect(formatAuthError(null, "login")).toMatch(/Try again/);
    expect(formatAuthError({}, "signup")).toMatch(/Try again/);
  });
});

describe("formatSignupNoSession", () => {
  it("treats empty identities as possible duplicate", () => {
    expect(formatSignupNoSession({ identities: [] })).toMatch(/already have an account/);
    expect(formatSignupNoSession(null)).toMatch(/already have an account/);
  });

  it("asks for email confirmation when user was created", () => {
    expect(formatSignupNoSession({ identities: [{ id: "1" }] })).toMatch(/confirmation link/);
  });
});

describe("auth + journal surface contracts", () => {
  it("AuthPage renders an accessible alert for failures", () => {
    const src = readFileSync("src/components/auth/AuthPage.tsx", "utf8");
    expect(src).toMatch(/role="alert"/);
    expect(src).toMatch(/formatAuthError/);
    expect(src).toMatch(/data-testid="auth-error"/);
    // Must not style the only inline error as muted (silent-looking).
    expect(src).not.toMatch(
      /authError && \(\s*<p className="mt-2 text-\[12px\]" style=\{\{ color: "var\(--muted-foreground\)" \}\}/,
    );
  });

  it("journal Save This Record shows accessible feedback", () => {
    const src = readFileSync("src/routes/_authenticated/journal.tsx", "utf8");
    expect(src).toMatch(/Save This Record/);
    expect(src).toMatch(/data-testid="journal-save-feedback"/);
    expect(src).toMatch(/role="alert"/);
    expect(src).toMatch(/setListOpen\(true\)/);
    expect(src).toMatch(/finally \{\s*setBusy\(false\);/s);
  });
});
