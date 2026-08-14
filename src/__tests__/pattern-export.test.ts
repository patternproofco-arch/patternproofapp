import { describe, expect, it } from "vitest";
import { buildPatternExport } from "@/lib/pattern-export";

// Includes legacy interpretive fields on purpose: older jsonb rows still carry
// them and they must never reach an export.
const analysis = {
  main_pattern_label: "Recurring contact around exchanges",
  pattern_summary: "Summary text",
  what_pattern_may_show: "Interpretation text",
  secondary_patterns: ["Escalation after boundary-setting"],
  abuser_tactics: [
    { tactic: "A", description: "desc a" },
    { tactic: "B", description: "desc b" },
  ],
  attorney_summary: "14 entries between March and August.",
  severity_indicators: [{ label: "Verbal threat", note: "documented in your records", source_incident_ids: ["i1"] }],
};

describe("buildPatternExport", () => {
  it("withholds every claim the survivor has not reviewed", () => {
    const r = buildPatternExport(analysis, {});
    expect(r.redactedAnalysis.attorney_summary).toBeUndefined();
    expect(r.redactedAnalysis.severity_indicators).toBeUndefined();
    expect(r.unsureCount).toBeGreaterThan(0);
    expect(r.rejectedCount).toBe(0);
  });

  it("never exports interpretive fields, even from legacy cached rows", () => {
    for (const reviewed of [
      {},
      { main_pattern: { status: "confirmed" as const }, interpretation: { status: "confirmed" as const }, "tactic:0": { status: "confirmed" as const } },
    ]) {
      const r = buildPatternExport(analysis, reviewed);
      const json = JSON.stringify(r.redactedAnalysis);
      const md = r.lines.join("\n");
      for (const blob of [json, md]) {
        expect(blob).not.toContain("Recurring contact");
        expect(blob).not.toContain("Interpretation text");
        expect(blob).not.toContain("Escalation after boundary-setting");
        expect(blob).not.toContain("desc a");
      }
      expect(r.redactedAnalysis.main_pattern_label).toBeUndefined();
      expect(r.redactedAnalysis.what_pattern_may_show).toBeUndefined();
      expect(r.redactedAnalysis.secondary_patterns).toBeUndefined();
      expect(r.redactedAnalysis.abuser_tactics).toBeUndefined();
    }
  });

  it("exports confirmed claims and honours survivor edits", () => {
    const r = buildPatternExport(analysis, {
      attorney_summary: { status: "edited", edited_note: "My own wording" },
      "sev:0": { status: "confirmed" },
    });
    expect(r.redactedAnalysis.attorney_summary).toBe("My own wording");
    expect(r.redactedAnalysis.severity_indicators).toHaveLength(1);
  });

  it("never exports a rejected claim", () => {
    const r = buildPatternExport(analysis, {
      attorney_summary: { status: "rejected" },
      "sev:0": { status: "rejected" },
    });
    expect(JSON.stringify(r.redactedAnalysis)).not.toContain("My own wording");
    expect(r.redactedAnalysis.attorney_summary).toBeUndefined();
    expect(r.rejectedCount).toBe(2);
  });
});
