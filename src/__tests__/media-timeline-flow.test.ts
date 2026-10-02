import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const evidencePage = readFileSync("src/routes/_authenticated/evidence.tsx", "utf8");
const batchDropzone = readFileSync("src/components/evidence/BatchDropzone.tsx", "utf8");
const proposals = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");
const uploadDrafts = readFileSync("src/lib/upload-draft.functions.ts", "utf8");
const draftsPage = readFileSync("src/routes/_authenticated/drafts.tsx", "utf8");
const timeline = readFileSync("src/routes/_authenticated/timeline.tsx", "utf8");
const linkMigration = readFileSync(
  "supabase/migrations/20260829120000_incident_evidence_links.sql",
  "utf8",
);
const landing = readFileSync("src/routes/index.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

describe("media to reviewed timeline wiring", () => {
  it("automatically transcribes single audio and video evidence uploads", () => {
    expect(evidencePage).toContain("wasAudioOrVideo");
    expect(evidencePage).toContain("transcribeFn({ data: { evidence_id: newRow.id } })");
    expect(evidencePage).toContain("Transcript ready. A timeline draft is ready for your review.");
  });

  it("builds review-only timeline drafts after single and batch processing", () => {
    expect(evidencePage).toContain("evidence_ids: [newRow.id]");
    expect(batchDropzone).toContain("evidence_ids: evidenceIds");
    expect(batchDropzone).toContain("Nothing becomes a journal entry until accepted");
  });

  it("does not create a second pending draft for the same source upload", () => {
    expect(proposals).toContain('eq("status", "pending")');
    expect(proposals).toContain("alreadyProposed.has(row.id)");
  });

  it("never drafts a recorded-media entry before its transcript is ready", () => {
    expect(proposals).toContain('row.transcript_status !== "ready"');
    expect(proposals).toContain("A filename or user title is not enough evidence");
  });

  it("preserves multiple survivor-confirmed journal links for one upload", () => {
    expect(proposals).toContain('from("incident_evidence_links").upsert');
    expect(proposals).toContain('.is("linked_incident_id", null)');
    expect(timeline).toContain('from("incident_evidence_links")');
    expect(linkMigration).toContain("PRIMARY KEY (incident_id, evidence_id)");
    expect(linkMigration).toContain("i.user_id = auth.uid()");
    expect(linkMigration).toContain("e.user_id = auth.uid()");
  });

  it("supports common iPhone, web, audio, and document picker formats", () => {
    for (const mime of [
      "video/quicktime",
      "video/webm",
      "audio/aac",
      "audio/ogg",
      "image/heic",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]) {
      expect(evidencePage).toContain(mime);
    }
  });
});

describe("upload auto soft drafts for /drafts", () => {
  it("queues soft drafts for photo, audio, and video without inventing event dates", () => {
    expect(uploadDrafts).toContain("ensureMediaUploadDrafts");
    expect(uploadDrafts).toContain('date_certainty: "unknown"');
    expect(uploadDrafts).toContain("draft: { date: null, description, abuse_types: [] }");
    expect(uploadDrafts).toContain("Nothing reaches your timeline until you approve this draft.");
    expect(uploadDrafts).toContain("model: null");
    expect(uploadDrafts).not.toContain("court-ready");
    expect(uploadDrafts).not.toContain("LOVABLE_API_KEY");
  });

  it("falls back to filename when mime is missing or octet-stream", () => {
    expect(uploadDrafts).toContain("kindFromFilename");
    expect(uploadDrafts).toContain("evidence_lookup_failed");
    expect(uploadDrafts).toContain("already_pending");
    expect(uploadDrafts).toContain("insert_failed");
  });

  it("skips evidence already waiting as a pending proposed draft", () => {
    expect(uploadDrafts).toContain('eq("status", "pending")');
    expect(uploadDrafts).toContain("alreadyProposed.has(row.id)");
  });

  it("wires single photo upload and A/V fallback into soft drafts", () => {
    expect(evidencePage).toContain("ensureMediaUploadDrafts");
    expect(evidencePage).toContain('fileMime.startsWith("image/")');
    expect(evidencePage).toContain("ensureDraftsFn({ data: { evidence_ids: [newRow.id] } })");
    expect(evidencePage).toContain("A draft is waiting in Drafts to review.");
  });

  it("accepts every file the batch uploader allows, so no batch silently skips drafts", () => {
    const maxFiles = Number(batchDropzone.match(/const MAX_FILES = (\d+)/)?.[1]);
    expect(maxFiles).toBeGreaterThan(0);
    expect(uploadDrafts).toContain(`evidence_ids: z.array(z.string().uuid()).min(1).max(${maxFiles})`);
  });

  it("wires batch upload soft-draft ensure after AI propose, before photo OCR", () => {
    expect(batchDropzone).toContain("ensureMediaUploadDrafts");
    expect(batchDropzone).toContain("ensureDrafts({ data: { evidence_ids: evidenceIds } })");
    expect(batchDropzone).toContain("Nothing becomes a journal entry until accepted");
    // Soft drafts must not wait on extractDoc (images → needs_ocr → AI hang).
    const softIdx = batchDropzone.indexOf("ensureDrafts({ data: { evidence_ids: evidenceIds } })");
    const ocrAfter = batchDropzone.indexOf(
      "Photo/PDF/Word text extraction after drafts are queued",
    );
    expect(softIdx).toBeGreaterThan(0);
    expect(ocrAfter).toBeGreaterThan(softIdx);
  });

  it("keeps the survivor drafts review page as the approval gate", () => {
    expect(draftsPage).toContain("ProposedTimelineReview");
    expect(draftsPage).toContain("Accept is when you decide");
    expect(draftsPage).toContain("timeline until you approve it");
  });
});

describe("public cleanup merge blockers", () => {
  it("routes the Attorney portal to its public information page", () => {
    expect(landing).toContain('to="/for-attorneys"');
  });

  it("uses the approved landing promise and keeps the timeline preview", () => {
    expect(landing).toContain("One private timeline.");
    expect(landing).toContain("Everything in the right order.");
    // Inline chronology sample must stay labeled as demo / not a real record.
    expect(landing).toContain("<ChronologyThread");
    expect(landing).toContain("SAMPLE_BEADS");
    const thread = readFileSync("src/components/ChronologyThread.tsx", "utf8");
    expect(thread).toContain("Demo · not a real record");
  });

  it("does not globally shrink mobile pages with CSS zoom", () => {
    expect(styles).not.toMatch(/html\s*\{\s*zoom:\s*0\.9/);
  });
});
