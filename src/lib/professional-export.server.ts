/** Shared, server-only record boundary for both professional ZIP handlers.
 * Call only AFTER assertLink has frozen blanket grants and applied case scope.
 * Null source/draft are legacy manual/non-draft; AI always needs confirmation.
 */
import type { AttorneyLink } from "@/lib/attorney-access.server";
import {
  evidenceForProfessional,
  incidentForProfessional,
} from "@/lib/professional-view";
import { formatIncidentDate, formatEvidenceDate } from "@/lib/dates";
import { describeReviewDate } from "@/lib/review-date-certainty";
import {
  incidentEligible,
  evidenceEligible,
} from "@/lib/professional-record-eligibility";
export {
  incidentEligible,
  evidenceEligible,
} from "@/lib/professional-record-eligibility";

// Supabase builders vary by table; keep the adapter boundary deliberately small.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
export type ExportRow = Record<string, any>;
const PAGE_SIZE = 500;
const ID_CHUNK_SIZE = 100;
const CASE_COLUMNS =
  "id,user_id,case_type,other_party,jurisdiction,relationship_type,highlighted_incident_ids,attached_evidence_ids";

/** Fresh builder per page, deterministic unique-key ordering, no silent empty errors. */
export async function readExportRows(
  build: () => any,
  what: string,
): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const result = await build()
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data))
      throw new Error(`Could not completely read ${what}.`);
    rows.push(...result.data);
    if (result.data.length < PAGE_SIZE) return rows;
  }
}

export async function readExportIds(
  ids: string[],
  build: (chunk: string[]) => any,
  what: string,
): Promise<ExportRow[]> {
  const unique = [...new Set(ids)];
  const rows: ExportRow[] = [];
  for (let i = 0; i < unique.length; i += ID_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + ID_CHUNK_SIZE);
    rows.push(...(await readExportRows(() => build(chunk), what)));
  }
  return rows;
}

export async function readExportOne(
  query: any,
  what: string,
): Promise<ExportRow | null> {
  const result = await query.maybeSingle();
  if (result.error || result.data === undefined)
    throw new Error(`Could not read ${what}.`);
  return result.data;
}

export async function loadProfessionalExportRecords(
  admin: Admin,
  link: AttorneyLink,
  clientId: string,
) {
  // assertLink is responsible for converting old blanket consent to a snapshot.
  // Never fall back to an owner-wide query if that operation did not complete.
  if (link.include_all_incidents || link.include_all_evidence)
    throw new Error("Export requires a resolved sharing snapshot.");
  let caseRecord: ExportRow | null = null;
  let incidentIds = [...new Set(link.scope_incidents ?? [])];
  let evidenceIds = [...new Set(link.scope_evidence ?? [])];
  if (link.case_id) {
    caseRecord = await readExportOne(
      admin
        .from("cases")
        .select(CASE_COLUMNS)
        .eq("user_id", clientId)
        .eq("id", link.case_id),
      "authorized case",
    );
    if (
      !caseRecord ||
      caseRecord.id !== link.case_id ||
      caseRecord.user_id !== clientId
    ) {
      throw new Error("The authorized case is no longer available.");
    }
    incidentIds = incidentIds.filter((id) =>
      (caseRecord!.highlighted_incident_ids ?? []).includes(id),
    );
    evidenceIds = evidenceIds.filter((id) =>
      (caseRecord!.attached_evidence_ids ?? []).includes(id),
    );
  }
  const incidentScope = new Set(incidentIds);
  const evidenceScope = new Set(evidenceIds);
  const [rawIncidents, rawEvidence] = await Promise.all([
    readExportIds(
      incidentIds,
      (chunk) =>
        admin
          .from("incidents")
          .select("*")
          .eq("user_id", clientId)
          .in("id", chunk)
          .is("deleted_at", null)
          .or("is_draft.is.null,is_draft.eq.false")
          .or(
            "source.is.null,source.neq.ai_extracted,confirmed_at.not.is.null",
          ),
      "shared incidents",
    ),
    readExportIds(
      evidenceIds,
      (chunk) =>
        admin
          .from("evidence")
          .select("*")
          .eq("user_id", clientId)
          .in("id", chunk)
          .is("deleted_at", null)
          .or("review_status.is.null,review_status.neq.suggested"),
      "shared evidence",
    ),
  ]);
  const incidents = rawIncidents.filter(
    (row) =>
      row.user_id === clientId &&
      incidentScope.has(row.id) &&
      incidentEligible(row),
  );
  const eligibleIncidentIds = new Set(incidents.map((row) => row.id));
  for (const row of incidents) {
    if (
      row.anchor_incident_id &&
      !eligibleIncidentIds.has(row.anchor_incident_id)
    )
      row.anchor_incident_id = null;
  }
  const eligibleEvidenceIds = new Set(
    rawEvidence
      .filter(
        (row) =>
          row.user_id === clientId &&
          evidenceScope.has(row.id) &&
          evidenceEligible(row),
      )
      .map((row) => row.id),
  );
  for (const row of incidents) {
    if (
      row.source_evidence_id &&
      !eligibleEvidenceIds.has(row.source_evidence_id)
    )
      row.source_evidence_id = null;
  }
  // Keep storage input separate from rows that can leave the professional boundary.
  const storageEvidence = rawEvidence.filter(
    (row) => eligibleEvidenceIds.has(row.id) && row.user_id === clientId,
  );
  const evidence = rawEvidence
    .filter(
      (row) =>
        row.user_id === clientId &&
        evidenceScope.has(row.id) &&
        evidenceEligible(row),
    )
    .map((row) => {
      const clone = { ...row };
      delete clone.gps_lat;
      delete clone.gps_lon;
      delete clone.gps_reveal_opt_in;
      // An independently shared file may refer to a private/unconfirmed incident.
      if (!eligibleIncidentIds.has(clone.linked_incident_id))
        clone.linked_incident_id = null;
      if (
        clone.suggested_incident_id &&
        !eligibleIncidentIds.has(clone.suggested_incident_id)
      )
        clone.suggested_incident_id = null;
      for (const key of ["parent_evidence_id", "near_duplicate_of"]) {
        if (clone[key] && !eligibleEvidenceIds.has(clone[key]))
          clone[key] = null;
      }
      // Recording grants are not resolved by these exporters.
      if (clone.linked_recording_id) clone.linked_recording_id = null;
      return evidenceForProfessional(clone);
    });
  // Do not emit the case's complete id arrays or free-text private narrative.
  const allowedCase = caseRecord
    ? Object.fromEntries(
        [
          "id",
          "case_type",
          "other_party",
          "jurisdiction",
          "relationship_type",
        ].map((key) => [key, caseRecord![key]]),
      )
    : undefined;
  const byDateThenId = (a: ExportRow, b: ExportRow) =>
    String(a.date ?? "9999").localeCompare(String(b.date ?? "9999")) ||
    String(a.id).localeCompare(String(b.id));
  incidents.sort(byDateThenId);
  evidence.sort(byDateThenId);
  return {
    incidents: incidents.map((row) => incidentForProfessional(row)),
    evidence,
    storageEvidence,
    latestCase: allowedCase,
  };
}

/** `date` is an asserted event day only for exact records. Surrogates are
 * explicitly named sort_date, with certainty/range/anchor metadata retained.
 */
export function professionalDateColumns(
  row: ExportRow,
  kind: "incident" | "evidence",
) {
  const info = describeReviewDate(row);
  return {
    date: info.certainty === "exact" ? row.date : "",
    sort_date: row.date ?? "",
    date_display:
      kind === "incident" ? formatIncidentDate(row) : formatEvidenceDate(row),
    date_precision: row.date_precision ?? "exact",
    date_range_start: row.date_range_start ?? "",
    date_range_end: row.date_range_end ?? "",
    anchor_label: row.anchor_label ?? "",
  };
}

export async function loadProfessionalExportExtras(
  admin: Admin,
  link: AttorneyLink,
  clientId: string,
  attorneyId: string,
  records: Awaited<ReturnType<typeof loadProfessionalExportRecords>>,
) {
  const incidentIds = records.incidents.map((row) => String(row.id));
  const evidenceIds = records.evidence.map((row) => String(row.id));
  const [reviews, docRequests] = await Promise.all([
    readExportIds(
      evidenceIds,
      (chunk) =>
        admin
          .from("attorney_evidence_reviews")
          .select("evidence_id,status,exhibit_label,notes,linked_incident_id")
          .eq("attorney_user_id", attorneyId)
          .eq("client_user_id", clientId)
          .in("evidence_id", chunk),
      "evidence reviews",
    ),
    readExportRows(
      () =>
        admin
          .from("attorney_document_requests")
          .select("title,details,status,created_at,completed_at")
          .eq("attorney_user_id", attorneyId)
          .eq("client_user_id", clientId)
          .eq("link_id", link.id),
      "document requests",
    ),
  ]);
  const allowedEvidence = new Set(evidenceIds);
  const allowedIncidents = new Set(incidentIds);
  return {
    docRequests,
    reviews: reviews
      .filter((row) => allowedEvidence.has(row.evidence_id))
      .map((row) => ({
        evidence_id: String(row.evidence_id),
        status: row.status as string | null,
        exhibit_label: row.exhibit_label as string | null,
        notes: row.notes as string | null,
        linked_incident_id: allowedIncidents.has(row.linked_incident_id)
          ? String(row.linked_incident_id)
          : null,
      })),
  };
}

/** Match single-file owner-folder rules, additionally reject encoded traversal/separators. */
export function safeProfessionalStoragePath(
  value: unknown,
  clientId: string,
): string {
  const path = typeof value === "string" ? value : "";
  if (
    !path.startsWith(`${clientId}/`) ||
    path.length <= clientId.length + 1 ||
    path.includes("..") ||
    /[\\\x00-\x1f\x7f?#]/.test(path) ||
    /%/i.test(path) ||
    path.split("/").some((part) => part === "" || part === ".")
  ) {
    throw new Error(
      "A shared evidence file has an unsafe or unavailable storage path.",
    );
  }
  return path;
}

export async function downloadProfessionalFile(
  admin: Admin,
  evidence: ExportRow,
  clientId: string,
): Promise<ArrayBuffer> {
  const path = safeProfessionalStoragePath(evidence.file_url, clientId);
  const { data: blob, error } = await admin.storage
    .from("evidence-files")
    .download(path);
  if (error || !blob || typeof blob.arrayBuffer !== "function")
    throw new Error(
      "A shared evidence file could not be downloaded. No package was created.",
    );
  return await blob.arrayBuffer();
}

export function professionalEvidenceFilename(evidence: ExportRow): string {
  const ext =
    String(evidence.file_url).match(/\.([a-zA-Z0-9]{1,10})$/)?.[1] ?? "bin";
  const info = describeReviewDate(evidence);
  const date = String(
    info.certainty === "exact" ? evidence.date : info.certainty,
  ).replace(/[^a-zA-Z0-9_-]/g, "_");
  // Full id prevents collisions between entries sharing the first eight characters.
  const id = String(evidence.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  const title = String(evidence.title ?? "evidence")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 60);
  return `${date}_${id}_${title}.${ext}`;
}

/** Recheck after potentially slow storage reads, before publishing any archive.
 * This detects withdrawal/deletion/confirmation changes during assembly; it is
 * not a transactional lock against changes after signing an expiring URL.
 */
export async function assertProfessionalExportStillCurrent(
  admin: Admin,
  attorneyId: string,
  clientId: string,
  originalLink: AttorneyLink,
  originalRecords: Awaited<ReturnType<typeof loadProfessionalExportRecords>>,
) {
  const { assertLink } = await import("@/lib/attorney-access.server");
  const current = await assertLink(admin, attorneyId, clientId);
  if (
    current.id !== originalLink.id ||
    current.case_id !== originalLink.case_id ||
    current.include_communications !== originalLink.include_communications
  ) {
    throw new Error(
      "Sharing changed while the package was being prepared. Please retry.",
    );
  }
  const records = await loadProfessionalExportRecords(admin, current, clientId);
  if (JSON.stringify(records) !== JSON.stringify(originalRecords)) {
    throw new Error(
      "Shared records changed while the package was being prepared. Please retry.",
    );
  }
}
