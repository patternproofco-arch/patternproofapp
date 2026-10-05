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

import { isGrantSnapshotEligible, isMissingReadinessColumn } from "@/lib/sharing/share-readiness";
import { selectAllPages } from "@/lib/in-chunks.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/**
 * A selected item that did not make it into a grant. Never dropped silently: the
 * caller shows this to the survivor so she knows exactly what the recipient will
 * not see, and why.
 */
export type ExcludedItem = {
  kind: "incident" | "file";
  id: string;
  /** kept_private: she marked it private. not_available: deleted or not hers. */
  reason: "kept_private" | "not_available";
};

export type ShareScope = {
  include_all_incidents?: boolean;
  include_all_evidence?: boolean;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
};

// Every read below pages: the API silently caps one request at 1,000 rows, and a
// survivor can now hold thousands of entries. An unpaged read left everything past
// the first 1,000 out of the grant with no error.
async function ownedIds(admin: Admin, table: "incidents" | "evidence", clientUserId: string) {
  const rows = await selectAllPages<{ id: string }>(
    (from, to) =>
      admin
        .from(table)
        .select("id")
        .eq("user_id", clientUserId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to),
    { what: table === "incidents" ? "incident" : "file" },
  );
  return rows.map((r) => r.id);
}

/**
 * Ids that "share all" may sweep in, and that explicit picks must also pass.
 *
 * Journal entries and files both have a real control ("Keep private" /
 * "OK to share later" / "Still deciding") on the Journal and Evidence screens.
 * A kept-private item "won't show up when you share with someone". So only
 * ok_to_share is in; private and undecided stay out (fail-closed). NULL or a
 * missing readiness value is grandfathered in (rows from before the column
 * existed). Only a MISSING readiness column (migration not applied yet) falls
 * back to every owned item; any other query error stops the share.
 */
async function shareableIds(
  admin: Admin,
  table: "incidents" | "evidence",
  clientUserId: string,
  createdAtOrBefore?: string,
) {
  // Only a missing readiness column (migration not applied yet) may fall back to
  // every owned item. Any other failure must stop the share: falling back to
  // "everything" on a transient error would sweep in entries kept private.
  let columnMissing = false;
  let rows: Array<{ id: string; share_readiness?: string | null }>;
  try {
    rows = await selectAllPages<{ id: string; share_readiness?: string | null }>(
      (from, to) =>
        (createdAtOrBefore
          ? admin
              .from(table)
              .select("id, share_readiness")
              .eq("user_id", clientUserId)
              .is("deleted_at", null)
              .lte("created_at", createdAtOrBefore)
          : admin
              .from(table)
              .select("id, share_readiness")
              .eq("user_id", clientUserId)
              .is("deleted_at", null)
        )
          .order("id", { ascending: true })
          .range(from, to)
          .then((r: { data: unknown; error: { message: string } | null }) => {
            if (isMissingReadinessColumn(r.error)) {
              columnMissing = true;
            }
            return r;
          }),
      { what: table === "incidents" ? "incident" : "file" },
    );
  } catch (e) {
    if (columnMissing) return ownedIds(admin, table, clientUserId);
    throw e;
  }
  return rows
    .filter((r) => isGrantSnapshotEligible(r.share_readiness))
    .map((r) => r.id);
}

function uniq(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && !!id)));
}

/**
 * Replace include_all_* with the concrete ids that exist right now.
 * Fails closed for journal entries and files: a private or still-deciding item
 * is never swept in by "share everything" and never added by an explicit pick
 * either. (The invite screen only offers shareable items, so a pick of one means
 * a stale page, and the safe outcome is to leave it out.) Never widens beyond
 * what she owns and hasn't deleted.
 */
export async function snapshotShareScope<T extends ShareScope>(
  admin: Admin,
  clientUserId: string,
  scope: T,
  /**
   * Only for grants made before scope freezing existed: "share all" is limited to items
   * that existed when the survivor made the invitation, never what was added after.
   */
  opts: { createdAtOrBefore?: string } = {},
): Promise<
  T &
    Required<Pick<ShareScope, "include_all_incidents" | "include_all_evidence">> & {
      /** Exactly the ids now shared. Always present, whatever shape went in. */
      scope_incidents: string[];
      scope_evidence: string[];
      /** Items the survivor explicitly picked that were NOT shared, and why. */
      excluded: ExcludedItem[];
    }
> {
  const [ownedInc, ownedEv] = await Promise.all([
    ownedIds(admin, "incidents", clientUserId),
    ownedIds(admin, "evidence", clientUserId),
  ]);
  const ownEv = new Set(ownedEv);
  const ownInc = new Set(ownedInc);
  const [shareableIncList, shareableEvList] = await Promise.all([
    shareableIds(admin, "incidents", clientUserId, opts.createdAtOrBefore),
    shareableIds(admin, "evidence", clientUserId, opts.createdAtOrBefore),
  ]);
  const shareableInc = new Set(shareableIncList);
  const shareableEv = new Set(shareableEvList);
  const excluded: ExcludedItem[] = [];

  let incidents: string[];
  if (scope.include_all_incidents) {
    incidents = Array.from(shareableInc);
  } else {
    incidents = [];
    for (const id of uniq(scope.scope_incidents ?? [])) {
      if (ownInc.has(id) && shareableInc.has(id)) incidents.push(id);
      else
        excluded.push({
          kind: "incident",
          id,
          reason: ownInc.has(id) ? "kept_private" : "not_available",
        });
    }
  }

  let evidence: string[];
  if (scope.include_all_evidence) {
    evidence = Array.from(shareableEv);
  } else {
    evidence = [];
    for (const id of uniq(scope.scope_evidence ?? [])) {
      if (ownEv.has(id) && shareableEv.has(id)) evidence.push(id);
      else
        excluded.push({
          kind: "file",
          id,
          reason: ownEv.has(id) ? "kept_private" : "not_available",
        });
    }
  }

  return {
    ...scope,
    include_all_incidents: false,
    include_all_evidence: false,
    scope_incidents: incidents,
    scope_evidence: evidence,
    excluded,
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
    const rows = await selectAllPages<{ id: string }>(
      (from, to) =>
        admin
          .from(t)
          .select("id")
          .eq("user_id", clientUserId)
          .is("deleted_at", null)
          .lte("created_at", cutoff)
          .order("id", { ascending: true })
          .range(from, to),
      { what: t === "incidents" ? "incident" : "file" },
    );
    return rows.map((r) => r.id);
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
