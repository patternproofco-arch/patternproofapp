export type InviteApplicationStatus = "pending_review" | "approved" | "rejected";

export type InviteStep =
  "signed-out" | "checking" | "wrong-account" | "apply" | "pending" | "rejected" | "accepting";

export const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Which screen an invited attorney sees. Approval is database-owned: this only
 * chooses what to show, and "accepting" is reachable solely for an approved row.
 */
export function nextInviteStep(input: {
  hasUser: boolean;
  checked: boolean;
  status: InviteApplicationStatus | null;
  accountEmail?: string | null;
  invitedEmail?: string | null;
}): InviteStep {
  if (!input.hasUser) return "signed-out";
  if (input.invitedEmail && !sameEmail(input.accountEmail, input.invitedEmail))
    return "wrong-account";
  if (!input.checked) return "checking";
  if (input.status === "approved") return "accepting";
  if (input.status === "pending_review") return "pending";
  if (input.status === "rejected") return "rejected";
  return "apply";
}
