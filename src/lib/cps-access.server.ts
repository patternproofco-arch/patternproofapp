/**
 * Server-authoritative access rules for child-protection professionals.
 *
 * Same shape as attorney-access.server.ts, and stricter:
 *  - access starts from an approved, unsuspended worker AND an active, unrevoked, unexpired link;
 *  - there is no "everything" flag: only the exact ids the survivor picked;
 *  - nothing the browser sends is trusted; a record id is checked against the link;
 *  - anything unresolved fails closed.
 */
import { isExpired, isRevoked } from "@/lib/attorney-access.server";
import { selectInChunks } from "@/lib/in-chunks.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type CpsLink = {
  id: string;
  worker_user_id: string;
  client_user_id: string;
  status: string;
  scope_incidents: string[];
  scope_evidence: string[];
  expires_at: string;
  revoked_at: string | null;
  case_ref?: string | null;
};

export const CPS_LINK_COLUMNS =
  "id,worker_user_id,client_user_id,status,scope_incidents,scope_evidence,expires_at,revoked_at,case_ref";

/** Approved, not suspended, mailbox re-check not overdue, and holding the role. */
export async function assertApprovedCpsWorker(admin: Admin, userId: string): Promise<void> {
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "cps_worker")
    .maybeSingle();
  if (!role) throw new Error("Child-protection role required");
  const { data: app, error } = await admin
    .from("cps_access_applications")
    .select("status,suspended_at,reverify_due_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !app || app.status !== "approved" || app.suspended_at) {
    throw new Error("Approval required");
  }
  if (app.reverify_due_at && isExpired(app.reverify_due_at)) {
    throw new Error("Please confirm your work email again");
  }
}

export function isLiveCpsLink(
  link: { status?: string | null; revoked_at?: string | null; expires_at?: string | null } | null | undefined,
): boolean {
  if (!link || link.status !== "active" || isRevoked(link.revoked_at)) return false;
  // A grant with no expiry is not a valid grant. Fail closed.
  if (!link.expires_at) return false;
  return !isExpired(link.expires_at);
}

export async function assertCpsLink(admin: Admin, workerId: string, clientId: string): Promise<CpsLink> {
  await assertApprovedCpsWorker(admin, workerId);
  const { data } = await admin
    .from("cps_client_links")
    .select(CPS_LINK_COLUMNS)
    .eq("worker_user_id", workerId)
    .eq("client_user_id", clientId)
    .eq("status", "active")
    .is("revoked_at", null)
    .maybeSingle();
  if (!isLiveCpsLink(data)) throw new Error("No active access");
  return {
    ...data,
    scope_incidents: Array.isArray(data.scope_incidents) ? data.scope_incidents : [],
    scope_evidence: Array.isArray(data.scope_evidence) ? data.scope_evidence : [],
  } as CpsLink;
}

/** Is one specific record inside what she picked? There is no "all" shortcut. */
export function idInCpsScope(
  link: Pick<CpsLink, "scope_incidents" | "scope_evidence">,
  kind: "incident" | "evidence",
  id: string,
): boolean {
  const ids = kind === "incident" ? link.scope_incidents : link.scope_evidence;
  return Array.isArray(ids) && ids.includes(id);
}

export type Picks = { incidents: string[]; evidence: string[] };
export type ScopeResult = {
  scope: Picks;
  /** Why each pick was left out, for her screen. Never says anything to the worker. */
  excluded: Array<{ kind: "incident" | "evidence"; id: string; reason: string }>;
};

/**
 * Turn her picks into a grant scope. Only records that are hers, not deleted, and safe to share
 * get in, and only if she marked them OK to share. Left out: AI-written entries she has not
 * confirmed, evidence her attorney marked privileged, anything private, undecided or not hers. A failed read shares nothing.
 */
export async function buildCpsScope(admin: Admin, clientUserId: string, picks: Picks): Promise<ScopeResult> {
  const excluded: ScopeResult["excluded"] = [];
  const incidentIds = Array.from(new Set(picks.incidents ?? []));
  const evidenceIds = Array.from(new Set(picks.evidence ?? []));

  const incidentRows = await selectInChunks<{
    id: string;
    source: string | null;
    confirmed_at: string | null;
    deleted_at: string | null;
    share_readiness: string | null;
  }>(
    incidentIds,
    (chunk) =>
      admin
        .from("incidents")
        .select("id,source,confirmed_at,deleted_at,share_readiness")
        .eq("user_id", clientUserId)
        .in("id", chunk),
    { what: "entry" },
  );
  const incidents: string[] = [];
  const byId = new Map(incidentRows.map((r) => [r.id, r]));
  for (const id of incidentIds) {
    const r = byId.get(id);
    if (!r || r.deleted_at) excluded.push({ kind: "incident", id, reason: "not available" });
    else if (r.source === "ai_extracted" && !r.confirmed_at)
      excluded.push({ kind: "incident", id, reason: "written by AI and not yet confirmed by you" });
    else if (r.share_readiness !== "ok_to_share")
      excluded.push({ kind: "incident", id, reason: "marked private or still deciding" });
    else incidents.push(id);
  }

  const evidenceRows = await selectInChunks<{ id: string; share_readiness: string | null; deleted_at: string | null }>(
    evidenceIds,
    (chunk) =>
      admin
        .from("evidence")
        .select("id,share_readiness,deleted_at")
        .eq("user_id", clientUserId)
        .in("id", chunk),
    { what: "file" },
  );
  const owned = new Set(evidenceRows.filter((r) => !r.deleted_at).map((r) => r.id));
  const notReady = new Set(evidenceRows.filter((r) => r.share_readiness !== "ok_to_share").map((r) => r.id));
  const reviewRows = await selectInChunks<{ evidence_id: string; status: string }>(
    evidenceIds,
    (chunk) =>
      admin
        .from("attorney_evidence_reviews")
        .select("evidence_id,status")
        .eq("client_user_id", clientUserId)
        .in("evidence_id", chunk),
    { what: "file" },
  );
  const privileged = new Set(reviewRows.filter((r) => r.status === "privileged").map((r) => r.evidence_id));
  const evidence: string[] = [];
  for (const id of evidenceIds) {
    if (!owned.has(id)) excluded.push({ kind: "evidence", id, reason: "not available" });
    else if (privileged.has(id)) excluded.push({ kind: "evidence", id, reason: "marked privileged by your attorney" });
    else if (notReady.has(id)) excluded.push({ kind: "evidence", id, reason: "marked private or still deciding" });
    else evidence.push(id);
  }
  return { scope: { incidents, evidence }, excluded };
}

/** Record a view. If the log cannot be written, the view does not happen. */
export async function logCpsView(
  admin: Admin,
  link: Pick<CpsLink, "id" | "worker_user_id" | "client_user_id">,
  itemKind: "incident" | "evidence" | "packet",
  itemId: string | null,
): Promise<void> {
  const { error } = await admin.from("cps_access_log").insert({
    link_id: link.id,
    worker_user_id: link.worker_user_id,
    client_user_id: link.client_user_id,
    item_kind: itemKind,
    item_id: itemId,
  });
  if (error) throw new Error("Could not record this view, so it was not shown");
}

/** Record several views in one write. If it fails, none of them are shown. */
export async function logCpsViews(
  admin: Admin,
  link: Pick<CpsLink, "id" | "worker_user_id" | "client_user_id">,
  items: Array<{ kind: "incident" | "evidence" | "packet"; id: string | null }>,
): Promise<void> {
  if (!items.length) return;
  const { error } = await admin.from("cps_access_log").insert(
    items.map((i) => ({
      link_id: link.id,
      worker_user_id: link.worker_user_id,
      client_user_id: link.client_user_id,
      item_kind: i.kind,
      item_id: i.id,
    })),
  );
  if (error) throw new Error("Could not record this view, so it was not shown");
}
