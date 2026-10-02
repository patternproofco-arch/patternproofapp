import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  draftPipelineChips,
  originChipLabel,
  requestPipelineChips,
} from "@/components/survivor/PipelineStatusChips";
import {
  entryShareChip,
  isShareEligible,
  normalizeShareReadiness,
} from "@/lib/sharing/share-readiness";

const review = readFileSync("src/components/ProposedTimelineReview.tsx", "utf8");
const draftsPage = readFileSync("src/routes/_authenticated/drafts.tsx", "utf8");
const requestCard = readFileSync("src/components/requests/RequestCard.tsx", "utf8");
const proposals = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");
const hinge = readFileSync("src/components/sharing/DraftTrustHinge.tsx", "utf8");
const chip = readFileSync("src/components/sharing/EntryStatusChip.tsx", "utf8");
const grantSnap = readFileSync("src/lib/grant-snapshot.server.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261001221000_incident_share_readiness.sql",
  "utf8",
);

describe("draft pipeline chip helpers (request → draft → binder)", () => {
  it("marks draft active and binder idle when not from a request", () => {
    const chips = draftPipelineChips({ fromRequest: false, willJoinBinder: false });
    expect(chips.find((c) => c.stage === "draft")?.state).toBe("active");
    expect(chips.find((c) => c.stage === "timeline")?.state).toBe("next");
    expect(chips.find((c) => c.stage === "binder")?.state).toBe("idle");
  });

  it("surfaces binder as next when accept will join an existing share", () => {
    const chips = draftPipelineChips({ fromRequest: true, willJoinBinder: true });
    expect(chips.find((c) => c.stage === "request")?.state).toBe("done");
    expect(chips.find((c) => c.stage === "binder")?.state).toBe("next");
  });

  it("labels origin honestly for request / AI / soft upload", () => {
    expect(originChipLabel({ fromRequest: true, model: null })).toBe("From request");
    expect(originChipLabel({ fromRequest: false, model: "google/gemini-2.5-pro" })).toBe(
      "AI organize",
    );
    expect(originChipLabel({ fromRequest: false, model: null })).toBe("Soft upload");
  });

  it("request tray chips keep private draft next until send", () => {
    const open = requestPipelineChips("open");
    expect(open.find((c) => c.stage === "draft")?.label).toMatch(/Private/i);
    expect(open.find((c) => c.stage === "binder")?.state).toBe("idle");
    expect(requestPipelineChips("submitted").find((c) => c.stage === "binder")?.state).toBe(
      "done",
    );
  });
});

describe("Soft CLEAR share readiness (fail-closed)", () => {
  it("normalizes unknown values to private", () => {
    expect(normalizeShareReadiness(null)).toBe("private");
    expect(normalizeShareReadiness("nope")).toBe("private");
    expect(normalizeShareReadiness("ok_to_share")).toBe("ok_to_share");
  });

  it("only ok_to_share is share-eligible", () => {
    expect(isShareEligible("ok_to_share")).toBe(true);
    expect(isShareEligible("private")).toBe(false);
    expect(isShareEligible("undecided")).toBe(false);
  });

  it("maps readiness + grant state to status chips", () => {
    expect(entryShareChip({ readiness: "private" })).toBe("kept_private");
    expect(entryShareChip({ readiness: "ok_to_share" })).toBe("ok_to_share");
    expect(entryShareChip({ readiness: "undecided" })).toBe("still_deciding");
    expect(entryShareChip({ readiness: "private", inActiveGrant: true })).toBe("shared");
    expect(entryShareChip({ readiness: "ok_to_share", wasWithdrawn: true })).toBe(
      "access_withdrawn",
    );
  });

  it("migration defaults private and never widens access by itself", () => {
    expect(migration).toContain("share_readiness text NOT NULL DEFAULT 'private'");
    expect(migration).toContain("Never widens access by itself");
    expect(migration).toContain("ok_to_share");
  });

  it("grant snapshots intersect with ok_to_share only (fail closed if column missing)", () => {
    expect(grantSnap).toContain('eq("share_readiness", "ok_to_share")');
    expect(grantSnap).toContain("fail closed");
  });
});

describe("draft-trust hinge UI (Experience Soft CLEAR · PR A)", () => {
  it("hinge is radio Soft CLEAR copy with Keep private default path", () => {
    expect(hinge).toContain("Who can see this?");
    expect(hinge).toContain("Keep private");
    expect(hinge).toContain("OK to share later");
    expect(hinge).toContain("Still deciding");
    expect(hinge).toContain('data-testid="draft-trust-hinge"');
    expect(hinge).toContain("DraftTrustHingeInline");
  });

  it("entry status chips wire Soft CLEAR copy + edit callback", () => {
    expect(chip).toContain("ENTRY_SHARE_CHIP_COPY");
    expect(chip).toContain("entryShareChip");
    expect(chip).toContain('data-testid="entry-status-chip"');
    expect(chip).toContain("onEditReadiness");
  });

  it("drafts review uses Soft CLEAR hinge + pipeline chips + empty honesty", () => {
    expect(review).toContain("DRAFTS TO REVIEW");
    expect(review).not.toMatch(/exhibit-tag">AI DRAFTS/);
    expect(review).toContain("drafts-empty-honesty");
    expect(review).toContain("Nothing in drafts right now");
    expect(review).toContain("When you save a draft");
    expect(review).toContain("DraftTrustHingeInline");
    expect(review).toContain("share_readiness");
    expect(review).toContain("PipelineStatusChips");
    expect(draftsPage).toContain("trust hinge");
  });

  it("accept persists share_readiness and never invents a share from readiness alone", () => {
    expect(proposals).toContain('share_readiness: z.enum(["private", "ok_to_share", "undecided"])');
    expect(proposals).toContain("share_readiness: shareReadiness");
    expect(proposals).toContain("Never invent a share for ordinary upload/AI drafts");
  });

  it("wires request→draft→binder chips on RequestCard without weakening private-until-send", () => {
    expect(requestCard).toContain("requestPipelineChips");
    expect(requestCard).toContain("Nothing is visible to them until you press Send");
  });
});
