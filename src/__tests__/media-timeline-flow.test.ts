import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const evidencePage = readFileSync("src/routes/_authenticated/evidence.tsx", "utf8");
const batchDropzone = readFileSync("src/components/evidence/BatchDropzone.tsx", "utf8");
const proposals = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");
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

describe("public cleanup merge blockers", () => {
  it("routes the Attorney portal to its public information page", () => {
    expect(landing).toContain('to="/for-attorneys"');
  });

  it("uses the approved landing promise and keeps the timeline preview", () => {
    expect(landing).toContain("One private timeline.");
    expect(landing).toContain("Everything in the right order.");
    expect(landing).toContain("<DashboardPreview />");
  });

  it("does not globally shrink mobile pages with CSS zoom", () => {
    expect(styles).not.toMatch(/html\s*\{\s*zoom:\s*0\.9/);
  });
});
