type Scope = {
  scope_incidents: string[];
  scope_evidence: string[];
  include_patterns?: boolean;
};

// Generated database types are refreshed by the host after migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

type LiveLink = {
  id: string;
  status?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  scope_incidents: string[] | null;
  scope_evidence: string[] | null;
};

/** The pair's current (not revoked) grant, if any, before acceptance changes it. */
async function currentLink(
  admin: Admin,
  attorneyUserId: string,
  survivorUserId: string,
): Promise<LiveLink | null> {
  const { data, error } = await admin
    .from("attorney_client_links")
    .select("id,status,revoked_at,expires_at,scope_incidents,scope_evidence")
    .eq("attorney_user_id", attorneyUserId)
    .eq("client_user_id", survivorUserId)
    .is("revoked_at", null)
    .neq("status", "revoked")
    .maybeSingle();
  if (error)
    throw new Error("We couldn't check the existing share. Nothing was changed. Try again.");
  return (data as LiveLink | null) ?? null;
}

/**
 * Only trusted server callers supply the authenticated actor and frozen ids.
 *
 * Grant identity (enforced in SQL by accept_attorney_share, migration
 * 20261011173000_fresh_attorney_grants, and the prevent_grant_resurrection trigger):
 *  - A revoked or expired grant is NEVER re-armed in place. Revocation is permanent;
 *    acceptance inserts a NEW row with revoked_at NULL, a fresh expires_at, and only
 *    the scope passed here.
 *  - A current grant for the same pair is updated in place, and its scope_incidents,
 *    scope_evidence and every include_* flag are REPLACED by this scope (never merged).
 *
 * Here, after the grant is written, we record what she consented to:
 *  - a consent receipt (audit event "share_consent_receipt") with the exact ids, and
 *  - when an existing current grant was replaced, an audit event
 *    "share_grant_scope_replaced" with the before/after counts. (A new grant already
 *    gets "share_grant_created" from the SQL function.)
 */
export async function acceptAttorneyShare(
  admin: Admin,
  input: {
    invitationId: string;
    actorId: string;
    direction: "attorney" | "survivor";
    /** The pair this invitation is for, so the previous grant can be described. */
    attorneyUserId: string;
    survivorUserId: string;
    scope: Scope;
  },
): Promise<{
  id: string;
  client_user_id: string;
  replaced_link_id: string | null;
  receipt_recorded: boolean;
}> {
  const before = await currentLink(admin, input.attorneyUserId, input.survivorUserId);
  // Copy the previous counts now: the row object may be the one that gets updated.
  const previousCounts = before
    ? {
        status: before.status ?? null,
        revoked_at: before.revoked_at ?? null,
        expires_at: before.expires_at ?? null,
        incidents: (before.scope_incidents ?? []).length,
        files: (before.scope_evidence ?? []).length,
      }
    : null;

  const nextScope = {
    scope_incidents: Array.from(new Set(input.scope.scope_incidents)),
    scope_evidence: Array.from(new Set(input.scope.scope_evidence)),
    include_patterns: input.scope.include_patterns ?? false,
  };
  const { data, error } = await admin.rpc("accept_attorney_share", {
    _invitation_id: input.invitationId,
    _actor_id: input.actorId,
    _direction: input.direction,
    _scope: nextScope,
  });
  if (error || !data?.[0]?.id || !data[0].client_user_id) {
    throw new Error(error?.message ?? "The invitation could not be accepted. Try again.");
  }
  const result = data[0] as { id: string; client_user_id: string };
  const replaced = before && before.id === result.id ? before : null;

  // The SQL sets the expiry from the invitation; read it back for the receipt.
  const { data: written } = await admin
    .from("attorney_client_links")
    .select("expires_at")
    .eq("id", result.id)
    .maybeSingle();
  const { recordShareConsent } = await import("@/lib/sharing/consent-receipt.server");
  const receiptRecorded = await recordShareConsent(admin, {
    table: "attorney_client_links",
    linkId: result.id,
    survivorUserId: result.client_user_id,
    actorKind: input.direction,
    actorId: input.actorId,
    invitationId: input.invitationId,
    direction: input.direction,
    scope: nextScope,
    expiresAt: (written?.expires_at as string | null | undefined) ?? null,
    replaced: replaced && previousCounts ? { id: replaced.id, ...previousCounts } : null,
  });

  return { ...result, replaced_link_id: replaced?.id ?? null, receipt_recorded: receiptRecorded };
}
