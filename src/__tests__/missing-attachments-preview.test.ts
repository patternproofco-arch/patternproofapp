import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findMissingAttachments } from "@/lib/sharing/referenced-attachments.server";
import { selectionFingerprint } from "@/lib/sharing/merge-share-scope";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";

const CLIENT = "client-1";

describe("findMissingAttachments", () => {
  it("lists evidence linked to shared incidents that is not in the evidence scope", async () => {
    const admin = makeRwAdmin({
      evidence: [
        {
          id: "ev-shot",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: "inc-1",
          title: "Kitchen screenshot",
          file_type: "image/png",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
        {
          id: "ev-shared",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: "inc-1",
          title: "Already shared",
          file_type: "application/pdf",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
        {
          id: "ev-other",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: "inc-2",
          title: "Other entry",
          file_type: "image/jpeg",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
      ],
      incident_evidence_links: [],
    });

    const missing = await findMissingAttachments(admin, CLIENT, {
      sharedIncidentIds: ["inc-1"],
      sharedEvidenceIds: ["ev-shared"],
    });
    expect(missing.map((m) => m.id)).toEqual(["ev-shot"]);
    expect(missing[0]!.kind).toBe("screenshot");
    expect(missing[0]!.incident_ids).toEqual(["inc-1"]);
  });

  it("includes junction-linked files and marks private ones", async () => {
    const admin = makeRwAdmin({
      evidence: [
        {
          id: "ev-j",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: null,
          title: "Voice note",
          file_type: "audio/mpeg",
          transcript: "he said",
          share_readiness: "private",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
      ],
      incident_evidence_links: [
        { incident_id: "inc-1", evidence_id: "ev-j", user_id: CLIENT },
      ],
    });
    const missing = await findMissingAttachments(admin, CLIENT, {
      sharedIncidentIds: ["inc-1"],
      sharedEvidenceIds: [],
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]!.kept_private).toBe(true);
    expect(missing[0]!.kind).toBe("recording");
  });

  it("flags the original when only a derivative is in scope", async () => {
    const admin = makeRwAdmin({
      evidence: [
        {
          id: "ev-orig",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: null,
          title: "Original upload",
          file_type: "image/png",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
        {
          id: "ev-der",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: "inc-1",
          title: "Cropped copy",
          file_type: "image/png",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: "ev-orig",
          derivative_kind: "crop",
          original_filename: null,
        },
      ],
      incident_evidence_links: [],
    });
    const missing = await findMissingAttachments(admin, CLIENT, {
      sharedIncidentIds: ["inc-1"],
      sharedEvidenceIds: ["ev-der"],
    });
    // ev-der is in scope (linked to incident but already shared) — not missing.
    // Original parent is missing.
    expect(missing.map((m) => m.id).sort()).toEqual(["ev-orig"]);
    expect(missing[0]!.kind).toBe("original");
  });

  it("returns empty when every referenced file is already in scope", async () => {
    const admin = makeRwAdmin({
      evidence: [
        {
          id: "ev-1",
          user_id: CLIENT,
          deleted_at: null,
          review_status: "confirmed",
          linked_incident_id: "inc-1",
          title: "Shot",
          file_type: "image/png",
          transcript: null,
          share_readiness: "ok_to_share",
          parent_evidence_id: null,
          derivative_kind: null,
          original_filename: null,
        },
      ],
      incident_evidence_links: [],
    });
    const missing = await findMissingAttachments(admin, CLIENT, {
      sharedIncidentIds: ["inc-1"],
      sharedEvidenceIds: ["ev-1"],
    });
    expect(missing).toEqual([]);
  });
});

describe("deliberate include changes fingerprint (stale preview)", () => {
  it("toggling a missing attachment changes the fingerprint so create must re-verify", () => {
    const base = {
      include_all_incidents: true,
      include_all_evidence: false,
      scope_incidents: [] as string[],
      scope_evidence: [] as string[],
    };
    const before = selectionFingerprint({ ...base, deliberate_evidence: [] });
    const after = selectionFingerprint({
      ...base,
      deliberate_evidence: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
    });
    expect(before).not.toEqual(after);
  });
});

describe("preview + UI contracts for missing attachments", () => {
  const previewFn = readFileSync("src/lib/share-preview.functions.ts", "utf8");
  const previewUi = readFileSync("src/components/sharing/SharePreview.tsx", "utf8");
  const attorney = readFileSync("src/routes/_authenticated/share-with-attorney.tsx", "utf8");
  const advocate = readFileSync("src/routes/_authenticated/share-with-advocate.tsx", "utf8");
  const download = readFileSync("src/lib/evidence-download.server.ts", "utf8");
  const chrono = readFileSync("src/lib/chronology-workspace.server.ts", "utf8");

  it("previewShare returns missing_attachments and accepts deliberate_evidence", () => {
    expect(previewFn).toContain("missing_attachments");
    expect(previewFn).toContain("deliberate_evidence");
    expect(previewFn).toContain("findMissingAttachments");
    expect(previewFn).toContain("authorizeExplicitPicks: true");
  });

  it("SharePreview lists missing attachments and deliberate include refreshes fingerprint", () => {
    expect(previewUi).toContain("missing-attachments");
    expect(previewUi).toContain("onDeliberateEvidenceChange");
    expect(previewUi).toContain("deliberate_evidence: deliberateEvidenceIds");
    expect(previewUi).toContain("won&apos;t be able to open the source file");
    expect(previewUi).toMatch(/nothing is added automatically/i);
  });

  it("attorney and advocate share pages wire deliberateEvidenceIds", () => {
    for (const src of [attorney, advocate]) {
      expect(src).toContain("deliberateEvidenceIds");
      expect(src).toContain("onDeliberateEvidenceChange");
      expect(src).toContain("previewStatus.kind !== \"ok\"");
    }
  });

  it("downloads and chronology still gate files by share scope (no silent expose)", () => {
    expect(download).toContain("idInScope");
    expect(download).toContain("not_shared");
    expect(chrono).toContain("scope_evidence");
    expect(chrono).toContain("selectInChunks");
  });

  it("ending-access disclosure remains on share screens", () => {
    expect(attorney).toMatch(/already downloaded/i);
    expect(advocate).toMatch(/already downloaded/i);
    expect(previewUi).toMatch(/cannot retrieve copies already downloaded/i);
  });
});
