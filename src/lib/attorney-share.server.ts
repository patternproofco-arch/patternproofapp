type Scope = {
  scope_incidents: string[];
  scope_evidence: string[];
  include_patterns?: boolean;
};

// Generated database types are refreshed by the host after migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

type LiveLink = { id: string; scope_incidents: string[] | null; scope_evidence: string[] | null };

/** The pair's current (not revoked) grant, if any, before acceptance changes it. */
async function currentLink(
  admin: Admin,
  attorneyUserId: string,
  survivorUserId: string,
): Promise<LiveLink | null> {
  const { data, error } = await admin
    .from("attorney_client_links")
    .select("id,status,revoked_at,scope_incidents,scope_evidence")
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

  const audit = (event: string, meta: Record<string, unknown>) =>
    admin.rpc("record_audit_event", {
      p_user_id: result.client_user_id,
      p_event_type: event,
      p_subject_kind: "attorney_client_links",
      p_subject_id: result.id,
      p_actor_kind: input.direction,
      p_actor_id: input.actorId,
      p_meta: meta,
    });

  let receiptRecorded = true;
  const receipt = await audit("share_consent_receipt", {
    invitation_id: input.invitationId,
    direction: input.direction,
    accepted_at: new Date().toISOString(),
    scope_incidents: nextScope.scope_incidents,
    scope_evidence: nextScope.scope_evidence,
    include_patterns: nextScope.include_patterns,
    counts: { incidents: nextScope.scope_incidents.length, files: nextScope.scope_evidence.length },
    replaced_previous_scope: Boolean(replaced),
    previous_link_id: before?.id ?? null,
  });
  if (receipt?.error) {
    receiptRecorded = false;
    console.error("[consent] receipt write failed", receipt.error);
  }
  if (replaced) {
    const r = await audit("share_grant_scope_replaced", {
      invitation_id: input.invitationId,
      previous: previousCounts,
      next: { incidents: nextScope.scope_incidents.length, files: nextScope.scope_evidence.length },
    });
    if (r?.error) {
      receiptRecorded = false;
      console.error("[consent] replace audit write failed", r.error);
    }
  }

  return { ...result, replaced_link_id: replaced?.id ?? null, receipt_recorded: receiptRecorded };
}
