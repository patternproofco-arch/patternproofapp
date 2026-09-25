/**
 * Server-authoritative attorney access rules.
 *
 * These were previously private helpers inside attorney-portal.functions.ts,
 * which meant the only proof they worked was reading them. They now take the
 * database client as an argument so the real code paths run in tests against
 * an in-memory stand-in.
 *
 * The rules, in one place:
 *  - Access always starts from an ACTIVE, non-expired attorney_client_links row.
 *  - Route params, ids and anything the browser sends are never trusted.
 *  - A link tied to one case can only ever reach that case's own records.
 *  - A firm colleague's grant is inert the moment either attorney leaves the firm.
 *  - Anything unresolved fails closed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type AttorneyLink = {
  id: string;
  attorney_user_id?: string;
  client_user_id?: string;
  status: string;
  include_all_incidents: boolean;
  include_all_evidence: boolean;
  include_patterns: boolean;
  include_voice_notes: boolean;
  include_communications: boolean;
  include_legal_documents: boolean;
  scope_incidents: string[] | null;
  scope_evidence: string[] | null;
  scope_legal_documents?: string[];
  scope_threads?: string[];
  case_id?: string | null;
  expires_at?: string | null;
};

export const LINK_COLUMNS =
  "id,status,include_all_incidents,include_all_evidence,include_patterns,include_voice_notes,include_communications,include_legal_documents,scope_incidents,scope_evidence,case_id,expires_at";

/** True once a grant's expiry has passed. Expired access is treated the same as revoked. */
export function isExpired(expiresAt: string | null | undefined): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now();
}

export async function assertAttorney(admin: Admin, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "attorney")
    .maybeSingle();
  if (!data) throw new Error("Attorney role required");
}

export async function assertSameFirm(admin: Admin, attorneyA: string, attorneyB: string) {
  const { data, error } = await admin
    .from("firm_members")
    .select("user_id,firm_id")
    .in("user_id", [attorneyA, attorneyB]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ user_id: string; firm_id: string }>;
  const a = rows.find((m) => m.user_id === attorneyA)?.firm_id;
  const b = rows.find((m) => m.user_id === attorneyB)?.firm_id;
  if (!a || !b || a !== b) throw new Error("No verified firm membership for this case grant");
}

/**
 * A case_grant is only valid while both attorneys are current members of the
 * same firm. The grant row is intentionally not a durable identity boundary:
 * leaving or being removed from a firm immediately makes it inert, even before
 * the cleanup routine marks it revoked.
 */
export async function verifiedFirmGrantLinkIds(
  admin: Admin,
  granteeUserId: string,
  grants: Array<{ client_link_id: string }>,
): Promise<Set<string>> {
  if (!grants.length) return new Set();
  const { data: grantee } = await admin
    .from("firm_members")
    .select("firm_id")
    .eq("user_id", granteeUserId)
    .maybeSingle();
  if (!grantee) return new Set();

  const linkIds = Array.from(new Set(grants.map((g) => g.client_link_id)));
  const { data: links, error: linksError } = await admin
    .from("attorney_client_links")
    .select("id,attorney_user_id,status")
    .in("id", linkIds)
    .eq("status", "active");
  if (linksError) throw new Error(linksError.message);
  const linkRows = (links ?? []) as Array<{ id: string; attorney_user_id: string }>;
  const ownerIds = Array.from(new Set(linkRows.map((l) => l.attorney_user_id)));
  if (!ownerIds.length) return new Set();
  const { data: owners, error: ownersError } = await admin
    .from("firm_members")
    .select("user_id,firm_id")
    .in("user_id", ownerIds)
    .eq("firm_id", grantee.firm_id);
  if (ownersError) throw new Error(ownersError.message);
  const currentOwners = new Set(
    ((owners ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
  );
  return new Set(linkRows.filter((l) => currentOwners.has(l.attorney_user_id)).map((l) => l.id));
}

/**
 * If the link is tied to a specific case, fold that case's own records into the
 * link's scope so every downstream query returns only that case's data. Legacy
 * links with no case keep their previous "everything the survivor shared" shape.
 */
export async function applyCaseScope(
  admin: Admin,
  link: {
    case_id?: string | null;
    include_all_incidents: boolean;
    include_all_evidence: boolean;
    scope_incidents: string[] | null;
    scope_evidence: string[] | null;
    scope_legal_documents?: string[];
    scope_threads?: string[];
  },
  clientUserId: string,
): Promise<void> {
  if (!link.case_id) return;
  const { data: c } = await admin
    .from("cases")
    .select("highlighted_incident_ids,attached_evidence_ids,legal_document_ids,attached_thread_ids")
    .eq("id", link.case_id)
    .eq("user_id", clientUserId)
    .maybeSingle();
  link.include_all_incidents = false;
  link.include_all_evidence = false;
  link.scope_incidents = (c?.highlighted_incident_ids ?? []) as string[];
  link.scope_evidence = (c?.attached_evidence_ids ?? []) as string[];
  link.scope_legal_documents = (c?.legal_document_ids ?? []) as string[];
  link.scope_threads = (c?.attached_thread_ids ?? []) as string[];
}

export async function assertLink(
  admin: Admin,
  attorneyId: string,
  clientId: string,
): Promise<AttorneyLink> {
  const { data } = await admin
    .from("attorney_client_links")
    .select(LINK_COLUMNS)
    .eq("attorney_user_id", attorneyId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (!data || data.status !== "active" || isExpired(data.expires_at)) {
    throw new Error("No active access");
  }
  await applyCaseScope(admin, data, clientId);
  return data as AttorneyLink;
}

/**
 * Allow either the owning attorney OR an active case collaborator to open a
 * client case file. Read-only data + messaging only; private attorney notes
 * stay owner-only because their own queries scope by attorney.
 */
export async function assertCaseAccess(
  admin: Admin,
  userId: string,
  clientId: string,
): Promise<{
  link: AttorneyLink;
  role: "owner" | "collaborator";
  collabRole?: "paralegal" | "associate" | "attorney";
}> {
  const { data: owner } = await admin
    .from("attorney_client_links")
    .select(LINK_COLUMNS)
    .eq("attorney_user_id", userId)
    .eq("client_user_id", clientId)
    .maybeSingle();
  if (owner && owner.status === "active" && !isExpired(owner.expires_at)) {
    await applyCaseScope(admin, owner, clientId);
    return { link: owner as AttorneyLink, role: "owner" };
  }

  const { data: collabRows } = await admin
    .from("case_collaborators")
    .select("role,link_id")
    .eq("collaborator_user_id", userId)
    .eq("status", "active");

  const { data: grantRows } = await admin
    .from("case_grants")
    .select("client_link_id")
    .eq("attorney_user_id", userId)
    .is("revoked_at", null);

  const collabs = (collabRows ?? []) as Array<{ role: string; link_id: string }>;
  const grants = (grantRows ?? []) as Array<{ client_link_id: string }>;
  const candidateLinkIds = [...collabs.map((r) => r.link_id), ...grants.map((r) => r.client_link_id)];
  if (!candidateLinkIds.length) throw new Error("No active access");

  const { data: link } = await admin
    .from("attorney_client_links")
    .select(`${LINK_COLUMNS},attorney_user_id,client_user_id`)
    .in("id", candidateLinkIds)
    .eq("client_user_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (!link || isExpired(link.expires_at)) throw new Error("No active access");
  await applyCaseScope(admin, link, clientId);
  const collabRole = collabs.find((c) => c.link_id === link.id)?.role as
    | "paralegal"
    | "associate"
    | "attorney"
    | undefined;
  if (!collabRole && grants.some((g) => g.client_link_id === link.id)) {
    await assertSameFirm(admin, userId, link.attorney_user_id);
  }
  return { link: link as AttorneyLink, role: "collaborator", ...(collabRole ? { collabRole } : {}) };
}

/**
 * Same idea but keyed by link id (messages + document requests). Allows the
 * owning attorney, the survivor herself, or an active collaborator.
 */
export async function assertLinkParticipant(
  admin: Admin,
  linkId: string,
  userId: string,
): Promise<{
  link: { id: string; attorney_user_id: string; client_user_id: string; status: string };
  role: "owner" | "survivor" | "collaborator";
}> {
  const { data: link } = await admin
    .from("attorney_client_links")
    .select("id,attorney_user_id,client_user_id,status,expires_at")
    .eq("id", linkId)
    .maybeSingle();
  if (!link || link.status !== "active") throw new Error("No active link");
  if (link.client_user_id === userId) return { link, role: "survivor" };
  // Expiry only gates the attorney side — the survivor can always reach her own
  // thread even after a window she set has lapsed.
  if (isExpired(link.expires_at)) throw new Error("No active link");
  if (link.attorney_user_id === userId) return { link, role: "owner" };
  const { data: collab } = await admin
    .from("case_collaborators")
    .select("id")
    .eq("link_id", linkId)
    .eq("collaborator_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (collab) return { link, role: "collaborator" };
  const { data: grant } = await admin
    .from("case_grants")
    .select("id")
    .eq("client_link_id", linkId)
    .eq("attorney_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (grant) {
    await assertSameFirm(admin, userId, link.attorney_user_id);
    return { link, role: "collaborator" };
  }
  throw new Error("Not a participant");
}

/**
 * Is one specific record inside what the survivor shared? Used to check a
 * record id that arrived from the browser (a download, an export, a direct
 * server call) against the link that is supposed to authorize it.
 */
export function idInScope(
  link: Pick<
    AttorneyLink,
    "include_all_incidents" | "include_all_evidence" | "scope_incidents" | "scope_evidence"
  >,
  kind: "incident" | "evidence",
  id: string,
): boolean {
  if (kind === "incident") {
    if (link.include_all_incidents) return true;
    return (link.scope_incidents ?? []).includes(id);
  }
  if (link.include_all_evidence) return true;
  return (link.scope_evidence ?? []).includes(id);
}
