/**
 * Pure, testable decision rules for advocate → survivor invitations.
 * The server functions in advocate-survivor-invites.functions.ts delegate to
 * these so the authorization rules can be exercised by real unit tests rather
 * than only asserted as source text. Everything here fails closed.
 */
import { z } from "zod";

export type InviteRow = {
  id: string;
  advocate_user_id: string;
  survivor_email: string;
  status: string;
  expires_at?: string | null;
};

export type AcceptScope = {
  include_all_incidents: boolean;
  include_all_evidence: boolean;
  include_patterns: boolean;
  scope_incidents?: string[];
  scope_evidence?: string[];
};

/** Acknowledgements must be explicitly true — no defaults, no coercion. */
export const acknowledgementsSchema = z.object({
  who: z.literal(true),
  scope: z.literal(true),
  revoke: z.literal(true),
});

/** Scope is required; every share flag defaults to false (never whole vault). */
export const acceptScopeSchema = z.object({
  include_all_incidents: z.boolean().default(false),
  include_all_evidence: z.boolean().default(false),
  include_patterns: z.boolean().default(false),
  scope_incidents: z.array(z.string().uuid()).max(2000).optional().default([]),
  scope_evidence: z.array(z.string().uuid()).max(2000).optional().default([]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(8).max(128),
  acknowledgements: acknowledgementsSchema,
  // Required, explicit, all-false-by-default scope object.
  scope: z.object({ ...acceptScopeSchema.shape }),
});

export function inviteIsExpired(invite: Pick<InviteRow, "expires_at">, now = new Date()) {
  return Boolean(invite.expires_at && new Date(invite.expires_at) < now);
}

/**
 * Server-side gate for acting on an invite. Throws — never returns a partial
 * "maybe allowed" state — so callers cannot accidentally continue.
 */
export function assertInviteUsable(
  invite: InviteRow | null | undefined,
  accountEmail: string,
  now = new Date(),
): asserts invite is InviteRow {
  if (!invite) throw new Error("Invite not found");
  if (invite.status !== "pending") throw new Error("Invite no longer valid");
  if (inviteIsExpired(invite, now)) throw new Error("Invite expired");
  if (accountEmail.trim().toLowerCase() !== String(invite.survivor_email).trim().toLowerCase()) {
    throw new Error("This invite was sent to a different email address.");
  }
}

export function scopeIsEmpty(scope: AcceptScope) {
  return !(
    scope.include_all_incidents ||
    scope.include_all_evidence ||
    scope.include_patterns ||
    (scope.scope_incidents ?? []).length > 0 ||
    (scope.scope_evidence ?? []).length > 0
  );
}

export function assertScopeChosen(scope: AcceptScope) {
  if (scopeIsEmpty(scope)) {
    throw new Error("Choose at least one thing to share before accepting.");
  }
}

/** The single grant an accepted invite may create — nothing wider. */
export function buildGrantPayload(invite: InviteRow, clientUserId: string, scope: AcceptScope) {
  return {
    advocate_user_id: invite.advocate_user_id,
    client_user_id: clientUserId,
    survivor_invite_id: invite.id,
    include_all_incidents: scope.include_all_incidents,
    include_all_evidence: scope.include_all_evidence,
    include_patterns: scope.include_patterns,
    scope_incidents: scope.include_all_incidents ? [] : (scope.scope_incidents ?? []),
    scope_evidence: scope.include_all_evidence ? [] : (scope.scope_evidence ?? []),
    expires_at: invite.expires_at ?? null,
    status: "active",
    revoked_at: null as string | null,
  };
}
