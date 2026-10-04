/**
 * When an invitation's scope is decided.
 *
 * The survivor's consent happens when SHE creates the invitation, not when the
 * professional later opens it. So the scope is fixed to exact record ids at creation.
 * Acceptance can only narrow that list (an item she since deleted or marked private
 * drops out). It never looks at what exists "now", so records added between the
 * invitation and its acceptance are not shared and need a new, separate approval.
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
};

export type FrozenInvitationScope = {
  scope_incidents: string[];
  scope_evidence: string[];
  excluded: ExcludedItem[];
};

/** At creation: turn what she chose into exact ids, as of now. */
export async function freezeInvitationScope(
  admin: Admin,
  clientUserId: string,
  input: InvitationScopeInput,
): Promise<FrozenInvitationScope> {
  const f = await snapshotShareScope(admin, clientUserId, {
    include_all_incidents: input.include_all_incidents ?? false,
    include_all_evidence: input.include_all_evidence ?? false,
    scope_incidents: input.scope_incidents ?? [],
    scope_evidence: input.scope_evidence ?? [],
  });
  return { scope_incidents: f.scope_incidents ?? [], scope_evidence: f.scope_evidence ?? [], excluded: f.excluded };
}

/** At acceptance: the recorded ids, narrowed only. */
export async function scopeForAcceptance(
  admin: Admin,
  inv: InvitationScopeInput & { client_user_id: string; created_at?: string | null },
): Promise<FrozenInvitationScope> {
  const legacyBlanket = inv.include_all_incidents === true || inv.include_all_evidence === true;
  const f = await snapshotShareScope(
    admin,
    inv.client_user_id,
    {
      include_all_incidents: inv.include_all_incidents === true,
      include_all_evidence: inv.include_all_evidence === true,
      scope_incidents: inv.scope_incidents ?? [],
      scope_evidence: inv.scope_evidence ?? [],
    },
    legacyBlanket && inv.created_at ? { createdAtOrBefore: inv.created_at } : {},
  );
  // A legacy invitation with a blanket flag but no timestamp cannot be bounded. Share nothing.
  if (legacyBlanket && !inv.created_at) {
    return { scope_incidents: [], scope_evidence: [], excluded: f.excluded };
  }
  return { scope_incidents: f.scope_incidents ?? [], scope_evidence: f.scope_evidence ?? [], excluded: f.excluded };
}
