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

export interface AdvocateIncident {
  id: string;
  date: string | null;
  time: string | null;
  location: string | null;
  description: string | null;
  abuse_types: string[] | null;
  date_precision: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
}

export interface AdvocateEvidence {
  id: string;
  title: string | null;
  date: string | null;
  description: string | null;
  file_type: string | null;
  linked_incident_id: string | null;
  date_precision: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
}

export interface AdvocateCase {
  id: string | null;
  case_name: string | null;
  other_party: string | null;
  relationship_type: string | null;
  jurisdiction: string | null;
  case_types: string[] | null;
  pattern_summary: string | null;
}

type Rec = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;

export function shapeAdvocateIncident(row: Rec): AdvocateIncident {
  return {
    id: str(row["id"]) ?? "",
    date: str(row["date"]),
    time: str(row["time"]),
    location: str(row["location"]),
    description: str(row["description"]),
    abuse_types: arr(row["abuse_types"]),
    date_precision: str(row["date_precision"]),
    date_range_start: str(row["date_range_start"]),
    date_range_end: str(row["date_range_end"]),
  };
}

export function shapeAdvocateEvidence(row: Rec): AdvocateEvidence {
  return {
    id: str(row["id"]) ?? "",
    title: str(row["title"]),
    date: str(row["date"]),
    description: str(row["description"]),
    file_type: str(row["file_type"]),
    linked_incident_id: str(row["linked_incident_id"]),
    date_precision: str(row["date_precision"]),
    date_range_start: str(row["date_range_start"]),
    date_range_end: str(row["date_range_end"]),
  };
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

export function shapeAdvocateCase(row: Rec | null): AdvocateCase | null {
  if (!row) return null;
  return {
    id: str(row["id"]),
    case_name: str(row["case_name"]),
    other_party: str(row["other_party"]),
    relationship_type: str(row["relationship_type"]),
    jurisdiction: str(row["jurisdiction"]),
    case_types: arr(row["case_types"]),
    pattern_summary: str(row["pattern_summary"]),
  };
}

/** Keep only rows inside the granted date window (inclusive). */
export function withinDateWindow<T extends Rec>(
  rows: T[],
  start: string | null,
  end: string | null,
): T[] {
  if (!start && !end) return rows;
  return rows.filter((r) => {
    const d = str(r["date"]);
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}
