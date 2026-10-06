/**
 * Attachments referenced by shared incidents but not in the evidence scope.
 * Preview lists these so the survivor can deliberately include them — never
 * silently expose a file, and never leave the recipient with a source they
 * cannot open.
 */

import { selectInChunks } from "@/lib/in-chunks.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type ReferencedAttachment = {
  id: string;
  title: string;
  file_type: string;
  /** incident ids that reference this file */
  incident_ids: string[];
  /** Soft label for the survivor-facing preview */
  kind: "screenshot" | "transcript" | "recording" | "file" | "original";
  /** True when the file is still marked private / undecided */
  kept_private: boolean;
};

function classifyKind(row: {
  file_type?: string | null;
  transcript?: string | null;
  derivative_kind?: string | null;
  parent_evidence_id?: string | null;
}): ReferencedAttachment["kind"] {
  if (row.parent_evidence_id) return "original";
  const ft = (row.file_type ?? "").toLowerCase();
  if (row.transcript || /audio|voice|video|recording/.test(ft)) {
    if (/audio|voice|recording/.test(ft) || row.transcript) return "recording";
  }
  if (/image|png|jpe?g|gif|webp|heic|screenshot|screen.?shot/.test(ft)) return "screenshot";
  if (row.transcript) return "transcript";
  return "file";
}

function labelOf(row: { title?: string | null; original_filename?: string | null; file_type?: string | null }) {
  const t = (row.title ?? "").trim();
  if (t) return t;
  const f = (row.original_filename ?? "").trim();
  if (f) return f;
  return row.file_type?.trim() || "Attached file";
}

/**
 * Evidence ids linked to the given incidents (junction + legacy linked_incident_id),
 * owned by the survivor and not deleted.
 */
export async function evidenceIdsReferencedByIncidents(
  admin: Admin,
  clientUserId: string,
  incidentIds: string[],
): Promise<Map<string, string[]>> {
  const byEvidence = new Map<string, string[]>();
  if (!incidentIds.length) return byEvidence;

  const add = (evidenceId: string, incidentId: string) => {
    const cur = byEvidence.get(evidenceId) ?? [];
    if (!cur.includes(incidentId)) cur.push(incidentId);
    byEvidence.set(evidenceId, cur);
  };

  // Legacy primary link on evidence rows
  const linked = await selectInChunks<{ id: string; linked_incident_id: string | null }>(
    incidentIds,
    (chunk) =>
      admin
        .from("evidence")
        .select("id,linked_incident_id")
        .eq("user_id", clientUserId)
        .is("deleted_at", null)
        .neq("review_status", "suggested")
        .in("linked_incident_id", chunk),
    { what: "linked file" },
  );
  for (const row of linked) {
    if (row.linked_incident_id) add(row.id, row.linked_incident_id);
  }

  // Many-to-many junction. A missing table (migration not applied) must not
  // fail the preview — legacy linked_incident_id above still applies.
  for (let i = 0; i < incidentIds.length; i += 100) {
    const chunk = incidentIds.slice(i, i + 100);
    const { data: junction, error } = await admin
      .from("incident_evidence_links")
      .select("incident_id,evidence_id")
      .eq("user_id", clientUserId)
      .in("incident_id", chunk);
    if (error) {
      if (/does not exist|42P01|incident_evidence_links/i.test(error.message ?? "")) break;
      throw new Error("We couldn't check attached files. Try again in a moment.");
    }
    for (const row of junction ?? []) add(row.evidence_id as string, row.incident_id as string);
  }

  return byEvidence;
}

/**
 * Files referenced by shared incidents that are NOT in the evidence scope.
 * Does not invent access: listing is for deliberate include only.
 */
export async function findMissingAttachments(
  admin: Admin,
  clientUserId: string,
  opts: {
    sharedIncidentIds: string[];
    sharedEvidenceIds: string[];
  },
): Promise<ReferencedAttachment[]> {
  const sharedEv = new Set(opts.sharedEvidenceIds);
  const referenced = await evidenceIdsReferencedByIncidents(
    admin,
    clientUserId,
    opts.sharedIncidentIds,
  );
  const missingIds = [...referenced.keys()].filter((id) => !sharedEv.has(id));

  type EvRow = {
    id: string;
    title: string | null;
    original_filename: string | null;
    file_type: string | null;
    transcript: string | null;
    derivative_kind: string | null;
    parent_evidence_id: string | null;
    share_readiness: string | null;
  };

  const rows: EvRow[] = missingIds.length
    ? await selectInChunks<EvRow>(
        missingIds,
        (chunk) =>
          admin
            .from("evidence")
            .select(
              "id,title,original_filename,file_type,transcript,derivative_kind,parent_evidence_id,share_readiness",
            )
            .eq("user_id", clientUserId)
            .is("deleted_at", null)
            .neq("review_status", "suggested")
            .in("id", chunk),
        { what: "missing attachment" },
      )
    : [];

  // Also flag originals of shared derivatives that are themselves not in scope
  const parentIds = new Set<string>();
  const sharedRows = opts.sharedEvidenceIds.length
    ? await selectInChunks<{ id: string; parent_evidence_id: string | null }>(
        opts.sharedEvidenceIds,
        (chunk) =>
          admin
            .from("evidence")
            .select("id,parent_evidence_id")
            .eq("user_id", clientUserId)
            .is("deleted_at", null)
            .in("id", chunk),
        { what: "shared file parent" },
      )
    : [];
  for (const r of sharedRows) {
    if (r.parent_evidence_id && !sharedEv.has(r.parent_evidence_id)) {
      parentIds.add(r.parent_evidence_id);
    }
  }
  const parentMissing = [...parentIds].filter((id) => !rows.some((r) => r.id === id));
  if (parentMissing.length) {
    const parents = await selectInChunks<{
      id: string;
      title: string | null;
      original_filename: string | null;
      file_type: string | null;
      transcript: string | null;
      derivative_kind: string | null;
      parent_evidence_id: string | null;
      share_readiness: string | null;
    }>(
      parentMissing,
      (chunk) =>
        admin
          .from("evidence")
          .select(
            "id,title,original_filename,file_type,transcript,derivative_kind,parent_evidence_id,share_readiness",
          )
          .eq("user_id", clientUserId)
          .is("deleted_at", null)
          .neq("review_status", "suggested")
          .in("id", chunk),
      { what: "missing original" },
    );
    rows.push(...parents);
    for (const p of parents) {
      if (!referenced.has(p.id)) referenced.set(p.id, []);
    }
  }

  return rows.map((r) => {
    const readiness = r.share_readiness;
    const kept_private = readiness === "private" || readiness === "undecided";
    const isOriginal = parentIds.has(r.id);
    return {
      id: r.id,
      title: labelOf(r),
      file_type: r.file_type ?? "file",
      incident_ids: referenced.get(r.id) ?? [],
      kind: isOriginal ? "original" : classifyKind(r),
      kept_private,
    };
  });
}
