import { describe, it, expect } from "vitest";
import {
  shapeAdvocateIncident,
  shapeAdvocateEvidence,
  shapeAdvocateCase,
  withinDateWindow,
  ADVOCATE_FORBIDDEN_FIELDS,
} from "@/lib/advocate-scope";

const fullIncident = {
  id: "i1",
  user_id: "u1",
  date: "2026-01-02",
  time: "18:00",
  location: "Home",
  description: "What happened, in her words.",
  abuse_types: ["emotional"],
  witnesses: "Neighbor Jane",
  emotional_impact: "Frightened",
  severity_level: 4,
  has_escalation_flag: true,
  source: "survivor",
  confidence: 0.9,
  date_precision: "exact",
  date_range_start: null,
  date_range_end: null,
};

const fullEvidence = {
  id: "e1",
  user_id: "u1",
  title: "Text screenshot",
  date: "2026-01-02",
  description: "Message thread",
  file_type: "image",
  file_url: "https://x/y.png",
  storage_path: "u1/y.png",
  gps_lat: 40.1,
  gps_lon: -74.2,
  gps_reveal_opt_in: true,
  raw_metadata: { GPSLatitude: 40.1 },
  original_filename: "IMG_0042.HEIC",
  sha256: "abc",
  transcript: "full audio transcript",
  transcript_segments: [{ t: 0 }],
  voice_caption: "her voice note",
  voice_caption_audio_url: "https://x/a.m4a",
  linked_incident_id: "i1",
  date_precision: "exact",
  date_range_start: null,
  date_range_end: null,
};

describe("advocate scope projection", () => {
  it("gives advocates the survivor-approved incident narrative only", () => {
    const out = shapeAdvocateIncident(fullIncident);
    expect(out.description).toBe("What happened, in her words.");
    expect(out.location).toBe("Home");
    expect(out.abuse_types).toEqual(["emotional"]);
    expect(Object.keys(out).sort()).toEqual([
      "abuse_types",
      "date",
      "date_precision",
      "date_range_end",
      "date_range_start",
      "description",
      "id",
      "location",
      "time",
    ]);
  });

  it("never returns witnesses, impact, severity or user_id to an advocate", () => {
    const out = shapeAdvocateIncident(fullIncident) as unknown as Record<string, unknown>;
    for (const f of ADVOCATE_FORBIDDEN_FIELDS) expect(out).not.toHaveProperty(f);
  });

  it("gives advocates evidence metadata but never files, GPS, EXIF or transcripts", () => {
    const out = shapeAdvocateEvidence(fullEvidence) as unknown as Record<string, unknown>;
    expect(out["title"]).toBe("Text screenshot");
    expect(out["file_type"]).toBe("image");
    for (const f of ADVOCATE_FORBIDDEN_FIELDS) expect(out).not.toHaveProperty(f);
    expect(JSON.stringify(out)).not.toContain("IMG_0042");
    expect(JSON.stringify(out)).not.toContain("transcript");
  });

  it("limits the case summary to survivor-authored fields", () => {
    const out = shapeAdvocateCase({
      id: "c1",
      user_id: "u1",
      case_name: "Custody",
      other_party: "R.",
      relationship_type: "ex-partner",
      jurisdiction: "NJ",
      case_types: ["custody"],
      pattern_summary: "Summary she wrote.",
      highlighted_incident_ids: ["i1"],
    }) as unknown as Record<string, unknown>;
    expect(out["pattern_summary"]).toBe("Summary she wrote.");
    expect(out).not.toHaveProperty("user_id");
    expect(out).not.toHaveProperty("highlighted_incident_ids");
  });

  it("returns null for a missing case", () => {
    expect(shapeAdvocateCase(null)).toBeNull();
  });

  it("enforces the granted date window", () => {
    const rows = [
      { date: "2025-12-01" },
      { date: "2026-01-02" },
      { date: "2026-03-01" },
      { date: null },
    ];
    expect(withinDateWindow(rows, "2026-01-01", "2026-02-01")).toEqual([{ date: "2026-01-02" }]);
    expect(withinDateWindow(rows, null, null)).toHaveLength(4);
    expect(withinDateWindow(rows, "2026-01-01", null)).toHaveLength(2);
  });
});
