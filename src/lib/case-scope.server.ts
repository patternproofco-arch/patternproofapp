/**
 * What a case-scoped grant can show.
 *
 * A grant is the survivor's consent at the moment she shared. A case is a list she keeps editing.
 * If the grant simply followed the case, anything she attached to it later would reach the
 * attorney or advocate without a new approval. So the grant's own recorded ids (fixed when she
 * consented) are intersected with the case's current lists: taking something out of the case
 * takes it away from the recipient, but adding something to the case does not give it to them.
 *
 * Grants made before ids were recorded have none. For those, the case's lists are limited to
 * records that already existed when the grant began, the most she could have meant. (A record
 * that existed then but was attached to the case later cannot be told apart. That is stated in
 * the release notes, and re-sharing fixes it.)
 *
 * Failing to read the case or a date means nothing is shared, never everything.
 */

import { selectInChunks } from "@/lib/in-chunks.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type CaseScopeLink = {
  case_id?: string | null;
  created_at?: string | null;
  scope_incidents?: string[] | null;
  scope_evidence?: string[] | null;
};

export type EffectiveCaseScope = {
  incidents: string[];
  evidence: string[];
  legalDocuments: string[];
  threads: string[];
};

const NONE: EffectiveCaseScope = { incidents: [], evidence: [], legalDocuments: [], threads: [] };

async function existedBy(admin: Admin, table: "incidents" | "evidence", ids: string[], userId: string, cutoff: string) {
  if (!ids.length) return [];
  const rows = await selectInChunks<{ id: string }>(
    ids,
    (chunk) =>
      admin.from(table).select("id").eq("user_id", userId).in("id", chunk).lte("created_at", cutoff),
    { what: table === "incidents" ? "incident" : "file" },
  );
  return rows.map((r) => r.id);
}

export async function effectiveCaseScope(
  admin: Admin,
  link: CaseScopeLink,
  clientUserId: string,
): Promise<EffectiveCaseScope> {
  if (!link.case_id) return NONE;
  const { data: c, error } = await admin
    .from("cases")
    .select("highlighted_incident_ids,attached_evidence_ids,legal_document_ids,attached_thread_ids")
    .eq("id", link.case_id)
    .eq("user_id", clientUserId)
    .maybeSingle();
  if (error || !c) return NONE;

  const liveInc = ((c.highlighted_incident_ids ?? []) as string[]).filter(Boolean);
  const liveEv = ((c.attached_evidence_ids ?? []) as string[]).filter(Boolean);
  const base = {
    legalDocuments: (c.legal_document_ids ?? []) as string[],
    threads: (c.attached_thread_ids ?? []) as string[],
  };

  const frozenInc = link.scope_incidents ?? [];
  const frozenEv = link.scope_evidence ?? [];

  if (frozenInc.length || frozenEv.length) {
    const inc = new Set(frozenInc);
    const ev = new Set(frozenEv);
    return {
      incidents: liveInc.filter((id) => inc.has(id)),
      evidence: liveEv.filter((id) => ev.has(id)),
      ...base,
    };
  }

  // No recorded ids: an older grant. Only what existed when it began.
  if (!link.created_at) return { ...NONE, ...base };
  try {
    return {
      incidents: await existedBy(admin, "incidents", liveInc, clientUserId, link.created_at),
      evidence: await existedBy(admin, "evidence", liveEv, clientUserId, link.created_at),
      ...base,
    };
  } catch {
    return { ...NONE, ...base };
  }
}
