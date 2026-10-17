import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  canResendInvitation,
  INVITATION_STATUS_LABEL,
  invitationSurvivorStatus,
} from "@/lib/invitation-status";

const now = Date.parse("2026-10-17T12:00:00.000Z");
const future = "2026-11-01T00:00:00.000Z";
const past = "2026-10-01T00:00:00.000Z";

describe("invitationSurvivorStatus", () => {
  it("shows waiting for the attorney when nobody has applied", () => {
    expect(
      invitationSurvivorStatus({
        status: "pending",
        expiresAt: future,
        applicationPending: false,
        now,
      }),
    ).toBe("waiting_for_attorney");
  });
  it("shows waiting on approval only while an application is pending and the invite is live", () => {
    expect(
      invitationSurvivorStatus({
        status: "pending",
        expiresAt: future,
        applicationPending: true,
        now,
      }),
    ).toBe("awaiting_attorney_approval");
  });
  it("never pauses the clock: an invite past its date is expired even with a pending application", () => {
    expect(
      invitationSurvivorStatus({
        status: "pending",
        expiresAt: past,
        applicationPending: true,
        now,
      }),
    ).toBe("expired");
  });
  it("treats the exact expiry moment as expired", () => {
    expect(
      invitationSurvivorStatus({
        status: "pending",
        expiresAt: "2026-10-17T12:00:00.000Z",
        applicationPending: false,
        now,
      }),
    ).toBe("expired");
  });
  it("passes accepted and revoked through", () => {
    expect(
      invitationSurvivorStatus({
        status: "accepted",
        expiresAt: past,
        applicationPending: true,
        now,
      }),
    ).toBe("accepted");
    expect(
      invitationSurvivorStatus({
        status: "revoked",
        expiresAt: future,
        applicationPending: true,
        now,
      }),
    ).toBe("revoked");
  });
  it("offers resend only for expired invitations", () => {
    expect(canResendInvitation("expired")).toBe(true);
    for (const s of [
      "waiting_for_attorney",
      "awaiting_attorney_approval",
      "accepted",
      "revoked",
    ] as const) {
      expect(canResendInvitation(s)).toBe(false);
    }
  });
  it("labels never mention declined or reasons", () => {
    const text = Object.values(INVITATION_STATUS_LABEL).join(" ").toLowerCase();
    expect(text).not.toMatch(/declin|reject|denied|reason/);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("resend and privacy wiring", () => {
  const src = readFileSync("src/lib/attorney-invitations.functions.ts", "utf8");
  const resend = src.slice(
    src.indexOf("export const resendInvitation"),
    src.indexOf("export const revokeInvitation"),
  );
  it("resend narrows the old scope and never widens or reads current records", () => {
    expect(resend).toContain("scopeForAcceptance(supabaseAdmin, old)");
    expect(resend).not.toContain("freezeInvitationScope");
    expect(resend).toContain("include_all_incidents: false");
    expect(resend).toContain("include_all_evidence: false");
  });
  it("resend refuses legacy blanket invitations and empty scopes", () => {
    expect(resend).toContain("old.include_all_incidents === true");
    expect(resend).toContain("Nothing from the original invitation is left to share");
  });
  it("resend is limited to the owner, expired invites, and one live invite per attorney and case", () => {
    expect(resend).toContain('.eq("client_user_id", context.userId)');
    expect(resend).toContain("canResendInvitation(state)");
    expect(resend).toContain("You already have a live invitation");
  });
  it("uses the fixed 30 day window", () => {
    expect(resend).toContain("INVITATION_RESEND_DAYS");
  });
  it("the list only exposes a pending flag from applications, never other application data", () => {
    const list = src.slice(
      src.indexOf("export const listMyInvitations"),
      src.indexOf("export const resendInvitation"),
    );
    expect(list).toContain('.select("status")');
    expect(list).toContain('.eq("status", "pending")');
    expect(list).not.toMatch(
      /attorney_access_applications"\)\s*\.select\("[^"]*(bar_number|full_name|reviewed|decline)/,
    );
  });
  it("the page sends the new link by email and blocks double clicks", () => {
    const page = readFileSync("src/routes/_authenticated/share-with-attorney.tsx", "utf8");
    expect(page).toContain("if (resendingId) return;");
    expect(page).toContain("Send again");
    expect(page).toContain("idempotencyKey: `attorney-invitation-${r.invitation.id}`");
  });
});
