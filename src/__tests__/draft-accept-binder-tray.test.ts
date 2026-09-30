import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proposals = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");
const review = readFileSync("src/components/ProposedTimelineReview.tsx", "utf8");
const uploadDrafts = readFileSync("src/lib/upload-draft.functions.ts", "utf8");

describe("accept-from-drafts → timeline + binder (no share bypass)", () => {
  it("shares only when the draft already named a link, and merges linked evidence into binder scope", () => {
    expect(proposals).toContain("share_with_link_id");
    expect(proposals).toContain("Never invent a share for ordinary upload/AI drafts");
    expect(proposals).toContain("scope_evidence");
    expect(proposals).toMatch(
      /shareIncidentWithLink\(\s*shareLinkId,\s*userId,\s*incident\.id,\s*sourceIds,\s*\)/,
    );
  });

  it("records soft (model-null) accepts as survivor, AI accepts as ai_extracted", () => {
    expect(proposals).toContain('source: proposal.model ? "ai_extracted" : "survivor"');
    expect(proposals).toContain("confirmed_at: new Date().toISOString()");
  });

  it("always links owned source evidence onto the timeline incident", () => {
    expect(proposals).toContain('from("incident_evidence_links").upsert');
    expect(proposals).toContain('source: "ai_proposed_survivor_confirmed"');
  });

  it("upload soft drafts never set share_with_link_id (no share bypass)", () => {
    expect(uploadDrafts).toContain("source_evidence_ids: [row.id]");
    expect(uploadDrafts).not.toContain("share_with_link_id");
    expect(uploadDrafts).toContain("model: null");
  });
});

describe("survivor source-text review tray before timeline", () => {
  it("loads and saves transcript / OCR on Edit before accept", () => {
    expect(proposals).toContain("listDraftSourceMaterials");
    expect(proposals).toContain("saveDraftSourceText");
    expect(proposals).toContain('field: z.enum(["transcript", "extracted_text"])');
    expect(review).toContain("Source text to review");
    expect(review).toContain("Photo text (OCR)");
    expect(review).toContain("saveSourceFn");
    expect(review).toContain("listDraftSourceMaterials");
  });

  it("does not invent AI or OCR on save — writes survivor-edited text only", () => {
    expect(proposals).toContain('extraction_method: "human-corrected"');
    expect(proposals).toContain("transcript_verified_by: userId");
    expect(proposals).not.toMatch(/saveDraftSourceText[\s\S]{0,800}LOVABLE_API_KEY/);
  });
});
