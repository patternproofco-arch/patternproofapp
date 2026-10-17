import { describe, expect, it } from "vitest";
import { nextInviteStep, sameEmail } from "@/lib/invite-accept-step";

const base = {
  hasUser: true,
  checked: true,
  status: null,
  accountEmail: "Lawyer@Firm.test",
  invitedEmail: "lawyer@firm.test",
} as const;

describe("nextInviteStep", () => {
  it("shows the sign-up form when signed out", () => {
    expect(nextInviteStep({ ...base, hasUser: false })).toBe("signed-out");
  });

  it("never spins forever: a signed-in attorney without an application is asked to apply", () => {
    expect(nextInviteStep({ ...base, status: null })).toBe("apply");
  });

  it("waits calmly while the application is pending review", () => {
    expect(nextInviteStep({ ...base, status: "pending_review" })).toBe("pending");
  });

  it("only accepts for an approved application", () => {
    expect(nextInviteStep({ ...base, status: "approved" })).toBe("accepting");
    expect(nextInviteStep({ ...base, status: "pending_review" })).not.toBe("accepting");
    expect(nextInviteStep({ ...base, status: "rejected" })).not.toBe("accepting");
    expect(nextInviteStep({ ...base, status: null })).not.toBe("accepting");
  });

  it("reports a declined application", () => {
    expect(nextInviteStep({ ...base, status: "rejected" })).toBe("rejected");
  });

  it("waits for the application lookup before choosing", () => {
    expect(nextInviteStep({ ...base, checked: false, status: "approved" })).toBe("checking");
  });

  it("stops a signed-in account whose email differs from the invitation, even if approved", () => {
    expect(nextInviteStep({ ...base, accountEmail: "other@firm.test", status: "approved" })).toBe(
      "wrong-account",
    );
  });

  it("compares emails case-insensitively and rejects blanks", () => {
    expect(sameEmail(" A@B.test ", "a@b.TEST")).toBe(true);
    expect(sameEmail("", "a@b.test")).toBe(false);
    expect(sameEmail(null, null)).toBe(false);
  });
});
