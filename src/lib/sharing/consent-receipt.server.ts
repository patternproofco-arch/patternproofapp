/**
 * Consent receipt + audit for every survivor-consented grant write (attorney and
 * advocate, first accept and re-accept). Stored in the existing append-only
 * public.audit_events via public.record_audit_event (migration 20260721165306), so no
 * new table or migration is needed.
 *
 *  - "share_consent_receipt": always. Exactly what she consented to: ids, flags, expiry.
 *  - "share_grant_scope_replaced": when an existing row for the pair was overwritten
 *    (re-accept), with the before/after counts and the row's previous state.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type GrantTable = "attorney_client_links" | "advocate_client_links";

export type PreviousGrant = {
  id: string;
  status?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
  incidents: number;
  files: number;
};

export async function recordShareConsent(
  admin: Admin,
  input: {
    table: GrantTable;
    linkId: string;
    survivorUserId: string;
    actorKind: "survivor" | "attorney";
    actorId: string;
    invitationId: string;
    direction: "survivor" | "attorney";
    scope: { scope_incidents: string[]; scope_evidence: string[]; include_patterns: boolean };
    expiresAt?: string | null;
    /** The row that was overwritten in place, if any (copied BEFORE the write). */
    replaced: PreviousGrant | null;
  },
): Promise<boolean> {
  const write = (event: string, meta: Record<string, unknown>) =>
    admin.rpc("record_audit_event", {
      p_user_id: input.survivorUserId,
      p_event_type: event,
      p_subject_kind: input.table,
      p_subject_id: input.linkId,
      p_actor_kind: input.actorKind,
      p_actor_id: input.actorId,
      p_meta: meta,
    });

  let ok = true;
  const receipt = await write("share_consent_receipt", {
    table: input.table,
    invitation_id: input.invitationId,
    direction: input.direction,
    accepted_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
    scope_incidents: input.scope.scope_incidents,
    scope_evidence: input.scope.scope_evidence,
    include_patterns: input.scope.include_patterns,
    counts: {
      incidents: input.scope.scope_incidents.length,
      files: input.scope.scope_evidence.length,
    },
    replaced_previous_scope: Boolean(input.replaced),
    previous_link_id: input.replaced?.id ?? null,
  });
  if (receipt?.error) {
    ok = false;
    console.error("[consent] receipt write failed", receipt.error);
  }
  if (input.replaced) {
    const r = await write("share_grant_scope_replaced", {
      invitation_id: input.invitationId,
      previous: {
        incidents: input.replaced.incidents,
        files: input.replaced.files,
        status: input.replaced.status ?? null,
        revoked_at: input.replaced.revoked_at ?? null,
        expires_at: input.replaced.expires_at ?? null,
      },
      next: {
        incidents: input.scope.scope_incidents.length,
        files: input.scope.scope_evidence.length,
      },
    });
    if (r?.error) {
      ok = false;
      console.error("[consent] replace audit write failed", r.error);
    }
  }
  return ok;
}
