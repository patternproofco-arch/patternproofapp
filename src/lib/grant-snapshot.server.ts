/**
 * Phase 1 — no silent future sharing.
 *
 * A grant must never authorize items the survivor had not documented yet at the
 * moment they chose to share. "Share all my entries" is therefore recorded as an
 * explicit snapshot of the ids that existed right then, not as a standing
 * include-everything flag that keeps absorbing tomorrow's uploads.
 *
 * Every place that activates or widens an attorney/advocate grant runs the
 * scope through snapshotShareScope() first, so the rule lives in one place and
 * is enforced on the server, not in a screen.
 */

import { isGrantSnapshotEligible } from "@/lib/sharing/share-readiness";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ShareScope = {
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
};

async function ownedIds(admin: Admin, table: "incidents" | "evidence", clientUserId: string) {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("user_id", clientUserId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

/**
 * Ids "share all" may sweep in. Every row defaults to share_readiness='private'
 * and files have no readiness control, so readiness cannot gate grants without
 * silently emptying them. Only an explicit "still deciding" choice is held back.
 */
async function shareAllIds(admin: Admin, table: "incidents" | "evidence", clientUserId: string) {
  const { data, error } = await admin
    .from(table)
    .select("id, share_readiness")
    .eq("user_id", clientUserId)
    .is("deleted_at", null);
  if (error) return ownedIds(admin, table, clientUserId);
  return ((data ?? []) as Array<{ id: string; share_readiness?: string | null }>)
    .filter((r) => r.share_readiness !== "undecided")
    .map((r) => r.id);
}

function uniq(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && !!id)));
}

/**
 * Replace include_all_* with the concrete ids that exist right now.
 * Explicit picks are the survivor's own consent on this screen: they are kept
 * as long as she owns the item and it isn't deleted. Never widens beyond that.
 */
export async function snapshotShareScope<T extends ShareScope>(
  admin: Admin,
  clientUserId: string,
  scope: T,
): Promise<T & Required<Pick<ShareScope, "include_all_incidents" | "include_all_evidence">>> {
  const [ownedInc, ownedEv] = await Promise.all([
    ownedIds(admin, "incidents", clientUserId),
    ownedIds(admin, "evidence", clientUserId),
  ]);
  const ownInc = new Set(ownedInc);
  const ownEv = new Set(ownedEv);
  const incidents = scope.include_all_incidents
    ? await shareAllIds(admin, "incidents", clientUserId)
    : uniq(scope.scope_incidents ?? []).filter((id) => ownInc.has(id));
  const evidence = scope.include_all_evidence
    ? await shareAllIds(admin, "evidence", clientUserId)
    : uniq(scope.scope_evidence ?? []).filter((id) => ownEv.has(id));

  return {
    ...scope,
    include_all_incidents: false,
    include_all_evidence: false,
    scope_incidents: incidents,
    scope_evidence: evidence,
  };
}

/**
 * Items the survivor has documented since this grant was made, which the
 * professional therefore cannot see. Counts only — used to offer the survivor
 * an explicit "add these too" choice, never to share anything automatically.
 */
export async function unsharedSinceGrant(
  admin: Admin,
  clientUserId: string,
  link: ShareScope,
): Promise<{ incidents: string[]; evidence: string[] }> {
  const shownIncidents = new Set(link.scope_incidents ?? []);
  const shownEvidence = new Set(link.scope_evidence ?? []);
  const [allIncidents, allEvidence] = await Promise.all([
    ownedIds(admin, "incidents", clientUserId),
    ownedIds(admin, "evidence", clientUserId),
  ]);
  return {
    incidents: allIncidents.filter((id) => !shownIncidents.has(id)),
    evidence: allEvidence.filter((id) => !shownEvidence.has(id)),
  };
}

/**
 * Legacy grants created before scope freezing still carry blanket
 * include_all_* flags. The first time one is resolved we freeze it in place:
 * it keeps exactly the items that existed when the survivor granted access,
 * and stops absorbing anything documented since. Narrowing only — it can
 * never widen what a professional can see.
 */
export async function freezeLegacyBlanketScope(
  admin: Admin,
  table: "attorney_client_links" | "advocate_client_links",
  link: {
    id: string;
    created_at?: string | null;
    include_all_incidents?: boolean;
    include_all_evidence?: boolean;
    scope_incidents?: string[] | null;
    scope_evidence?: string[] | null;
  },
  clientUserId: string,
): Promise<void> {
  if (!link.include_all_incidents && !link.include_all_evidence) return;
  const cutoff = link.created_at ?? new Date().toISOString();

  const asOf = async (t: "incidents" | "evidence") => {
    const { data, error } = await admin
      .from(t)
      .select("id")
      .eq("user_id", clientUserId)
      .is("deleted_at", null)
      .lte("created_at", cutoff);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  };

  const incidents = link.include_all_incidents
    ? uniq([...(link.scope_incidents ?? []), ...(await asOf("incidents"))])
    : uniq(link.scope_incidents ?? []);
  const evidence = link.include_all_evidence
    ? uniq([...(link.scope_evidence ?? []), ...(await asOf("evidence"))])
    : uniq(link.scope_evidence ?? []);

  await admin
    .from(table)
    .update({
      include_all_incidents: false,
      include_all_evidence: false,
      scope_incidents: incidents,
      scope_evidence: evidence,
    })
    .eq("id", link.id)
    .eq("client_user_id", clientUserId);

  link.include_all_incidents = false;
  link.include_all_evidence = false;
  link.scope_incidents = incidents;
  link.scope_evidence = evidence;
}
