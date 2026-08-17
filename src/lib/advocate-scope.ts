/**
 * Advocate visibility scope — single source of truth.
 *
 * DV-organization advocates see the survivor-approved record of what happened:
 * incident date/time/location/description/tags, and evidence titles, dates,
 * descriptions and file types. They never receive evidence files, storage
 * paths, GPS coordinates, EXIF/raw metadata, original filenames, checksums,
 * transcripts, or audio captions.
 */

export const ADVOCATE_INCIDENT_FIELDS = [
  "id",
  "date",
  "time",
  "location",
  "description",
  "abuse_types",
  "date_precision",
  "date_range_start",
  "date_range_end",
] as const;

export const ADVOCATE_EVIDENCE_FIELDS = [
  "id",
  "title",
  "date",
  "description",
  "file_type",
  "linked_incident_id",
  "date_precision",
  "date_range_start",
  "date_range_end",
] as const;

/** Fields that must never appear in an advocate payload. */
export const ADVOCATE_FORBIDDEN_FIELDS = [
  "file_url",
  "storage_path",
  "gps_lat",
  "gps_lon",
  "gps_reveal_opt_in",
  "raw_metadata",
  "original_filename",
  "sha256",
  "transcript",
  "transcript_segments",
  "voice_caption",
  "voice_caption_audio_url",
  "witnesses",
  "emotional_impact",
  "severity_level",
  "user_id",
] as const;

type Rec = Record<string, unknown>;

function pick(row: Rec, fields: readonly string[]): Rec {
  const out: Rec = {};
  for (const f of fields) out[f] = row[f] ?? null;
  return out;
}

export function shapeAdvocateIncident(row: Rec): Rec {
  return pick(row, ADVOCATE_INCIDENT_FIELDS);
}

export function shapeAdvocateEvidence(row: Rec): Rec {
  return pick(row, ADVOCATE_EVIDENCE_FIELDS);
}

/** Case summary fields an advocate may see (survivor-authored). */
export const ADVOCATE_CASE_FIELDS = [
  "id",
  "case_name",
  "other_party",
  "relationship_type",
  "jurisdiction",
  "case_types",
  "pattern_summary",
] as const;

export function shapeAdvocateCase(row: Rec | null): Rec | null {
  return row ? pick(row, ADVOCATE_CASE_FIELDS) : null;
}

/** Keep only rows inside the granted date window (inclusive). */
export function withinDateWindow(
  rows: Rec[],
  start: string | null,
  end: string | null,
): Rec[] {
  if (!start && !end) return rows;
  return rows.filter((r) => {
    const d = typeof r["date"] === "string" ? (r["date"] as string) : null;
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}
