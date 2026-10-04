/**
 * What an attorney or advocate is sent about a record.
 *
 * Reads of shared records used `select("*")`, so every column the database has, now or added
 * later, reached the recipient: coordinates, image-fingerprint hashes, duplicate-detection links,
 * the survivor's AI-use choices, import batch ids and who verified a transcript. None of it is
 * content she chose to share, and none is used by the professional screens. These lists remove it
 * in one place, so a new internal column added tomorrow is still removed by name only if listed
 * here: the lists err toward removing, and a test fails if a column is exposed that is not on the
 * allowed shape.
 */

const EVIDENCE_HIDDEN = [
  "gps_lat",
  "gps_lon",
  "gps_reveal_opt_in",
  "raw_metadata",
  "perceptual_hash",
  "near_duplicate_of",
  "near_duplicate_status",
  "ai_permission",
  "share_readiness",
  "import_batch_id",
  "exif_choice",
  "extraction_verified_by",
  "transcript_verified_by",
  "suggested_incident_id",
  "match_reason",
] as const;

const INCIDENT_HIDDEN = ["ai_permission", "share_readiness", "template_key"] as const;

function without<T extends object>(row: T, keys: readonly string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) delete out[k];
  return out as T;
}

// Generic over the row type so a caller keeps its own typed row; casting to Record<string, unknown>
// at a call site makes the response fail the server-function serialization check.
export const evidenceForProfessional = <T extends object>(row: T): T => without(row, EVIDENCE_HIDDEN);
export const incidentForProfessional = <T extends object>(row: T): T => without(row, INCIDENT_HIDDEN);

export const HIDDEN_EVIDENCE_COLUMNS: readonly string[] = EVIDENCE_HIDDEN;
export const HIDDEN_INCIDENT_COLUMNS: readonly string[] = INCIDENT_HIDDEN;
