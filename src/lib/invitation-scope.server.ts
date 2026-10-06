/**
 * When an invitation's scope is decided.
 *
 * The survivor's consent happens when SHE creates the invitation, not when the
 * professional later opens it. So the scope is fixed to exact record ids at creation.
 * Acceptance can only narrow that list (an item she since deleted drops out). It never
 * looks at what exists "now", so records added between the invitation and its
 * acceptance are not shared and need a new, separate approval.
 *
 * Invitations made before this rule can still carry a blanket "share all" flag and no
 * ids. For those, acceptance is limited to items that existed when the invitation was
 * created, which is the most the survivor could have meant.
 */

import { snapshotShareScope, type ExcludedItem } from "@/lib/grant-snapshot.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type InvitationScopeInput = {
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
  /** When she shares a case, the case's records at this moment are what she is approving. */
  case_id?: string | null;
};

export type FrozenInvitationScope = {
  scope_incidents: string[];
  scope_evidence: string[];
  excluded: ExcludedItem[];
};

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

/** At creation: turn what she chose into exact ids, as of now. */
export async function freezeInvitationScope(
  admin: Admin,
  clientUserId: string,
  input: InvitationScopeInput,
): Promise<FrozenInvitationScope> {
  let caseIncidents: string[] = [];
  let caseEvidence: string[] = [];
  if (input.case_id) {
    const { data: c, error } = await admin
      .from("cases")
      .select("highlighted_incident_ids,attached_evidence_ids")
      .eq("id", input.case_id)
      .eq("user_id", clientUserId)
      .maybeSingle();
    // Not being able to read the case must not quietly share less or more than she saw.
    if (error || !c) throw new Error("We couldn't read that case, so nothing was shared. Try again.");
    caseIncidents = (c.highlighted_incident_ids ?? []) as string[];
    caseEvidence = (c.attached_evidence_ids ?? []) as string[];
  }

  const includeAllInc = input.include_all_incidents ?? false;
  const includeAllEv = input.include_all_evidence ?? false;
  const pickInc = input.scope_incidents ?? [];
  const pickEv = input.scope_evidence ?? [];
  const hasExplicitPicks = pickInc.length > 0 || pickEv.length > 0;

  // Case attachments and share-all never silently authorize private items.
  const fromCaseOrAll = await snapshotShareScope(
    admin,
    clientUserId,
    {
      include_all_incidents: includeAllInc,
      include_all_evidence: includeAllEv,
      scope_incidents: includeAllInc ? [] : caseIncidents,
      scope_evidence: includeAllEv ? [] : caseEvidence,
    },
    { authorizeExplicitPicks: false },
  );

  // Explicit picks on an invite authorize those owned items for THIS invitation
  // only — including ones still marked private. "OK to share later" alone grants nobody.
  let fromPicks = {
    scope_incidents: [] as string[],
    scope_evidence: [] as string[],
    excluded: [] as ExcludedItem[],
  };
  if (hasExplicitPicks) {
    fromPicks = await snapshotShareScope(
      admin,
      clientUserId,
      {
        include_all_incidents: false,
        include_all_evidence: false,
        scope_incidents: pickInc,
        scope_evidence: pickEv,
      },
      { authorizeExplicitPicks: true },
    );
  }

  return {
    scope_incidents: uniq([
      ...(fromCaseOrAll.scope_incidents ?? []),
      ...fromPicks.scope_incidents,
    ]),
    scope_evidence: uniq([
      ...(fromCaseOrAll.scope_evidence ?? []),
      ...fromPicks.scope_evidence,
    ]),
    excluded: [...fromCaseOrAll.excluded, ...fromPicks.excluded],
  };
}

/** At acceptance: the recorded ids, narrowed only. */
export async function scopeForAcceptance(
  admin: Admin,
  inv: InvitationScopeInput & { client_user_id: string; created_at?: string | null },
): Promise<FrozenInvitationScope> {
  const legacyBlanket = inv.include_all_incidents === true || inv.include_all_evidence === true;
  // Already-frozen invitations: keep every owned, non-deleted id she approved.
  // Readiness is not re-checked here — she authorized those exact ids at create.
  // Delete still drops an item. Legacy blanket flags still honour readiness + cutoff.
  const f = await snapshotShareScope(
    admin,
    inv.client_user_id,
    {
      include_all_incidents: inv.include_all_incidents === true,
      include_all_evidence: inv.include_all_evidence === true,
      scope_incidents: inv.scope_incidents ?? [],
      scope_evidence: inv.scope_evidence ?? [],
    },
    legacyBlanket && inv.created_at
      ? { createdAtOrBefore: inv.created_at }
      : legacyBlanket
        ? {}
        : { authorizeExplicitPicks: true },
  );
  // A legacy invitation with a blanket flag but no creation time can't be bounded. Share nothing.
  if (legacyBlanket && !inv.created_at) {
    return { scope_incidents: [], scope_evidence: [], excluded: f.excluded };
  }
  return { scope_incidents: f.scope_incidents ?? [], scope_evidence: f.scope_evidence ?? [], excluded: f.excluded };
}
