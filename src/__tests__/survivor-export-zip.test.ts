import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { createHash } from "crypto";
import { fakeAdmin, type Tables } from "./helpers/fake-supabase";
import { buildSurvivorExportZip } from "@/lib/export-zip.server";

/**
 * Builds the real survivor archive from an in-memory database and opens it.
 * Fictional accounts and records only.
 */
const SURV_A = "qa-survivor-a";
const SURV_B = "qa-survivor-b";
const CASE_A = "qa-case-a";

const PHOTO = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const PHOTO_SHA = createHash("sha256").update(Buffer.from(PHOTO)).digest("hex");

function world(): Tables {
  return {
    cases: [
      {
        id: CASE_A,
        user_id: SURV_A,
        case_name: "Fictional QA Matter",
        other_party: "Sample Other Party",
        highlighted_incident_ids: ["inc-1"],
        attached_evidence_ids: ["ev-1"],
        legal_document_ids: [],
        attached_thread_ids: [],
        updated_at: "2026-05-01T00:00:00Z",
      },
    ],
    incidents: [
      {
        id: "inc-1",
        user_id: SURV_A,
        date: "2026-01-05",
        location: "Sample Street",
        description: "Attached entry.",
        abuse_types: ["financial"],
        deleted_at: null,
      },
      {
        id: "inc-2",
        user_id: SURV_A,
        date: "2026-02-05",
        location: null,
        description: "Not attached to the case.",
        abuse_types: [],
        deleted_at: null,
      },
      {
        id: "inc-del",
        user_id: SURV_A,
        date: "2026-03-05",
        description: "Deleted entry.",
        abuse_types: [],
        deleted_at: "2026-03-06T00:00:00Z",
      },
      {
        id: "inc-other",
        user_id: SURV_B,
        date: "2026-03-07",
        description: "Another account's entry.",
        abuse_types: [],
        deleted_at: null,
      },
    ],
    evidence: [
      {
        id: "ev-1",
        user_id: SURV_A,
        title: "Sample photo",
        date: "2026-01-05",
        file_type: "image/jpeg",
        description: "Attached file.",
        file_url: `${SURV_A}/photo.jpg`,
        created_at: "2026-01-06T00:00:00Z",
        family_id: null,
        linked_incident_id: "inc-1",
        review_status: "confirmed",
        deleted_at: null,
        gps_lat: 40.1234,
        gps_lon: -74.5678,
        gps_reveal_opt_in: false,
      },
      {
        id: "ev-suggested",
        user_id: SURV_A,
        title: "Unconfirmed suggestion",
        date: "2026-01-07",
        file_type: "image/jpeg",
        file_url: `${SURV_A}/suggested.jpg`,
        created_at: "2026-01-07T00:00:00Z",
        family_id: null,
        review_status: "suggested",
        deleted_at: null,
      },
    ],
    communications: [],
    voice_notes: [],
    legal_documents: [],
    pattern_analyses: [],
    evidence_families: [],
    message_threads: [],
  };
}

async function openArchive(t: Tables, args: { userId: string; caseId?: string | null }) {
  const db = fakeAdmin(t, { [`${SURV_A}/photo.jpg`]: PHOTO, [`${SURV_A}/suggested.jpg`]: PHOTO });
  const built = await buildSurvivorExportZip(db, {
    userId: args.userId,
    caseId: args.caseId ?? null,
  });
  return { db, built };
}

describe("survivor archive export", () => {
  it("produces a real ZIP with the promised files", async () => {
    const { built } = await openArchive(world(), { userId: SURV_A, caseId: CASE_A });
    if (!built.ok) throw new Error(built.reason);

    expect(built.zipBuf.byteLength).toBeGreaterThan(500);
    const zip = await JSZip.loadAsync(built.zipBuf);
    const names = Object.keys(zip.files);
    for (const expected of [
      "manifest.json",
      "narrative.md",
      "incidents.csv",
      "evidence.csv",
      "provenance-and-integrity.md",
      "verify.sh",
    ]) {
      expect(names).toContain(expected);
    }
    expect(names.some((n) => n.startsWith("evidence/") && n.endsWith(".jpg"))).toBe(true);
  });

  it("records a verifiable hash for every included file", async () => {
    const { built } = await openArchive(world(), { userId: SURV_A, caseId: CASE_A });
    if (!built.ok) throw new Error(built.reason);
    const zip = await JSZip.loadAsync(built.zipBuf);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));

    expect(manifest.file_hashes).toHaveLength(1);
    expect(manifest.file_hashes[0].sha256).toBe(PHOTO_SHA);
    expect(manifest.hash_of_hashes).toMatch(/^[0-9a-f]{64}$/);

    // The stored bytes really are the bytes we hashed.
    const stored = await zip.file(manifest.file_hashes[0].path)!.async("uint8array");
    expect(createHash("sha256").update(Buffer.from(stored)).digest("hex")).toBe(PHOTO_SHA);
  });

  it("includes only what the account attached to the chosen case", async () => {
    const { built } = await openArchive(world(), { userId: SURV_A, caseId: CASE_A });
    if (!built.ok) throw new Error(built.reason);
    expect(built.counts.incidents).toBe(1);
    expect(built.counts.evidence).toBe(1);

    const zip = await JSZip.loadAsync(built.zipBuf);
    const incidentsCsv = await zip.file("incidents.csv")!.async("string");
    expect(incidentsCsv).toContain("Attached entry.");
    expect(incidentsCsv).not.toContain("Not attached to the case.");
    expect(incidentsCsv).not.toContain("Deleted entry.");
    expect(incidentsCsv).not.toContain("Another account's entry.");
  });

  it("leaves out unconfirmed suggestions and location coordinates", async () => {
    const { built } = await openArchive(world(), { userId: SURV_A });
    if (!built.ok) throw new Error(built.reason);
    const zip = await JSZip.loadAsync(built.zipBuf);
    const evidenceCsv = await zip.file("evidence.csv")!.async("string");

    expect(evidenceCsv).toContain("Sample photo");
    expect(evidenceCsv).not.toContain("Unconfirmed suggestion");
    expect(evidenceCsv).not.toContain("gps_lat");
    expect(evidenceCsv).not.toContain("40.1234");
  });

  it("refuses a case that belongs to another account", async () => {
    const { built } = await openArchive(world(), { userId: SURV_B, caseId: CASE_A });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.reason).toBe("case-not-found");
  });

  it("scopes every read to the requesting account", async () => {
    const { db } = await openArchive(world(), { userId: SURV_A, caseId: CASE_A });
    const scopeless = db.queries.filter(
      (q) => !q.ops.includes("eq:user_id") && q.table !== "evidence_families",
    );
    expect(scopeless).toEqual([]);
  });
});
