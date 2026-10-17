/**
 * What a survivor sees for an invitation she sent, in plain words.
 *
 * Privacy rule: the survivor learns only one thing about the attorney's review,
 * that an application using the email she invited is still waiting. She is never told
 * that an application was declined, why, or anything else the attorney submitted.
 * The 30 day invitation clock is never paused or extended by review.
 */
export type InvitationSurvivorStatus =
  "waiting_for_attorney" | "awaiting_attorney_approval" | "expired" | "accepted" | "revoked";

export function invitationSurvivorStatus(input: {
  status: string;
  expiresAt: string | null | undefined;
  /** True only when an application for the invited email is still pending review. */
  applicationPending: boolean;
  now?: number;
}): InvitationSurvivorStatus {
  if (input.status === "accepted") return "accepted";
  if (input.status === "revoked") return "revoked";
  const now = input.now ?? Date.now();
  const expired = !!input.expiresAt && Date.parse(input.expiresAt) <= now;
  if (input.status !== "pending" || expired) return "expired";
  return input.applicationPending ? "awaiting_attorney_approval" : "waiting_for_attorney";
}

/** Resend is offered only after an invitation has actually expired, and only on request. */
export function canResendInvitation(status: InvitationSurvivorStatus) {
  return status === "expired";
}

export const INVITATION_STATUS_LABEL: Record<InvitationSurvivorStatus, string> = {
  waiting_for_attorney: "Waiting for your attorney to open it",
  awaiting_attorney_approval: "Waiting on attorney approval",
  expired: "Expired. You can send it again.",
  accepted: "Accepted",
  revoked: "Cancelled",
};

export const INVITATION_RESEND_DAYS = 30;
