import { describe, expect, it } from "vitest";
import { buildPatternExport } from "@/lib/pattern-export";

const analysis = {
  main_pattern_label: "Recurring contact around exchanges",
  pattern_summary: "Summary text",
  what_pattern_may_show: "Interpretation text",
  abuser_tactics: [
    { tactic: "A", description: "desc a" },
    { tactic: "B", description: "desc b" },
  ],
};

describe("buildPatternExport", () => {
  it("withholds every claim the survivor has not reviewed", () => {
    const r = buildPatternExport(analysis, {});
    expect(r.redactedAnalysis.main_pattern_label).toBeUndefined();
    expect(r.redactedAnalysis.what_pattern_may_show).toBeUndefined();
    expect(r.redactedAnalysis.abuser_tactics).toBeUndefined();
    expect(r.unsureCount).toBeGreaterThan(0);
    expect(r.rejectedCount).toBe(0);
  });

  it("never exports a rejected claim, and drops narrative built on it", () => {
    const r = buildPatternExport(analysis, {
      main_pattern: { status: "rejected" },
      interpretation: { status: "rejected" },
    });
    expect(JSON.stringify(r.redactedAnalysis)).not.toContain("Recurring contact");
    expect(r.lines.join("\n")).not.toContain("Summary text");
    expect(r.rejectedCount).toBe(2);
  });

  it("exports confirmed claims and honours survivor edits", () => {
    const r = buildPatternExport(analysis, {
      main_pattern: { status: "edited", edited_note: "My own wording" },
      "tactic:0": { status: "confirmed" },
      "tactic:1": { status: "rejected" },
    });
    expect(r.redactedAnalysis.main_pattern_label).toBe("My own wording");
    expect(r.redactedAnalysis.abuser_tactics).toHaveLength(1);
    expect(JSON.stringify(r.redactedAnalysis)).not.toContain("desc b");
  });
});
