import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * "Keep private" tells a survivor the entry "won't show up when you share with
 * someone". The server rule leaves such entries out of "share everything", so the
 * screens that start a share must say what will really be shared, and must not go
 * blank on a database that doesn't have the readiness column yet.
 */
const read = (p: string) => readFileSync(p, "utf8").replace(/\s+/g, " ");
const attorneyInvite = read("src/routes/survivor-invite.$token.tsx");
const advocateInvite = read("src/routes/advocate-survivor-invite.$token.tsx");
const hinge = read("src/components/sharing/DraftTrustHinge.tsx");

describe("share-all honours Keep private on the screens that start a share", () => {
  it("the promise the survivor is shown is still the promise", () => {
    expect(hinge).toContain("It won’t show up when you share with someone.");
  });

  it("attorney invite counts and lists only what will be shared, and says what is left out", () => {
    expect(attorneyInvite).toContain("isGrantSnapshotEligible(i.share_readiness)");
    expect(attorneyInvite).toContain("isGrantSnapshotEligible(e.share_readiness)");
    expect(attorneyInvite).toContain("Share all incidents (${shareableIncidents.length})");
    expect(attorneyInvite).toContain("Share all evidence (${shareableEvidence.length})");
    expect(attorneyInvite).toContain("you kept private");
    expect(attorneyInvite).toContain("None of your entries are marked OK to share yet");
    expect(attorneyInvite).toContain("None of your files are marked OK to share yet");
    expect(attorneyInvite).toContain("on Evidence first");
    // Nothing starts selected. A private entry must not be pre-ticked either.
    expect(attorneyInvite).not.toMatch(/setSelectedIncidents\(\s*incidents\.map/);
    expect(attorneyInvite).not.toMatch(/setSelectedEvidence\(\s*evidence\.map/);
  });

  it("attorney invite falls back to the old query if the readiness column is missing", () => {
    expect(attorneyInvite).toContain('.select("id,date,description,abuse_types,share_readiness")');
    expect(attorneyInvite).toContain('.select("id,date,description,abuse_types")');
    expect(attorneyInvite).toContain('.select("id,title,date,file_type,share_readiness")');
    expect(attorneyInvite).toContain('.select("id,title,date,file_type")');
    expect(attorneyInvite).toContain("if (!withReadiness.error)");
  });

  it("advocate invite tells her private entries are not included", () => {
    expect(advocateInvite).toContain(
      "Journal entries you kept private are not included, even if you share incidents.",
    );
  });
});
