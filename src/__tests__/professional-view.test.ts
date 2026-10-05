import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HIDDEN_EVIDENCE_COLUMNS,
  evidenceForProfessional,
  incidentForProfessional,
} from "@/lib/professional-view";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("what a professional is sent about a file", () => {
  const row = {
    id: "f1",
    title: "Photo of the door",
    description: "Taken the next morning",
    date: "2026-03-02",
    date_precision: "exact",
    sha256: "abc",
    original_filename: "IMG_1.jpg",
    gps_lat: 40.1,
    gps_lon: -75.2,
    gps_reveal_opt_in: false,
    raw_metadata: { GPSLatitude: 40.1 },
    perceptual_hash: "ff00",
    near_duplicate_of: "f0",
    ai_permission: "none",
    share_readiness: "private",
    import_batch_id: "b1",
    transcript_verified_by: "user-1",
  };

  it("keeps the content and removes internal and location fields", () => {
    const out = evidenceForProfessional(row);
    for (const k of HIDDEN_EVIDENCE_COLUMNS) expect(Object.keys(out)).not.toContain(k);
    expect(out).toMatchObject({ id: "f1", title: "Photo of the door", date: "2026-03-02", sha256: "abc", original_filename: "IMG_1.jpg" });
  });

  it("does not change the original row", () => {
    evidenceForProfessional(row);
    expect(row.gps_lat).toBe(40.1);
  });

  it("removes the survivor's own AI and readiness settings from entries", () => {
    const out = incidentForProfessional({ id: "i1", description: "x", date: null, ai_permission: "all", share_readiness: "ok_to_share" });
    expect(out).toEqual({ id: "i1", description: "x", date: null });
  });
});

describe("every professional read goes through it (source contract)", () => {
  it("the attorney case file and the advocate case use the sanitizer", () => {
    expect(read("src/lib/attorney-portal.functions.ts")).toMatch(/evidenceForProfessional/);
    expect(read("src/lib/attorney-portal.functions.ts")).toMatch(/incidentForProfessional/);
    expect(read("src/lib/advocate.functions.ts")).toMatch(/evidenceForProfessional/);
    expect(read("src/lib/advocate.functions.ts")).toMatch(/incidentForProfessional/);
  });

  it("the survivor's 'what my attorney sees' view reads in batches and follows the same case rule", () => {
    const src = read("src/lib/court-timeline.functions.ts");
    expect(src).toMatch(/selectInChunks/);
    expect(src).toMatch(/effectiveCaseScope/);
    expect(src).not.toMatch(/\.in\("id", incIds\)/);
    expect(src).not.toMatch(/\.in\("id", evIds\)/);
  });
});
