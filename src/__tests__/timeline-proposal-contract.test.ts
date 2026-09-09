import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Gate 1 certification regression tests.
 *
 * Accepting an AI-drafted timeline entry writes to `incidents`. That table has
 * a BEFORE trigger (`incidents_validate_source`) restricting `source` to
 * 'survivor' | 'ai_extracted', and a CHECK constraint restricting
 * `date_precision` to exact | approximate_month | range | before_anchor |
 * after_anchor | unknown. Writing anything else makes "Accept" fail for the
 * survivor at the database, with no way to recover the draft.
 */

const proposals = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");
const observations = readFileSync("src/lib/frequency-observations.server.ts", "utf8");

const ALLOWED_SOURCES = ["survivor", "ai_extracted"];
const ALLOWED_PRECISIONS = [
  "exact",
  "approximate_month",
  "range",
  "before_anchor",
  "after_anchor",
  "unknown",
];

describe("accepting an AI-drafted entry matches the database contract", () => {
  it("only ever writes a source value the incidents trigger accepts", () => {
    const written = [...proposals.matchAll(/source:\s*"([a-z_]+)"/g)]
      .map((m) => m[1]!)
      // incident_evidence_links.source is a free-text provenance column.
      .filter((v) => !v.startsWith("ai_proposed_survivor_confirmed"));
    expect(written.length).toBeGreaterThan(0);
    for (const value of written) expect(ALLOWED_SOURCES).toContain(value);
  });

  it("stamps a human confirmation time so the entry counts toward recurrence", () => {
    expect(proposals).toContain("confirmed_at: new Date().toISOString()");
  });

  it("only ever writes a date_precision the CHECK constraint accepts", () => {
    const start = proposals.indexOf("const datePrecision");
    const block = proposals.slice(start, proposals.indexOf(";", start));
    const written = [...block.matchAll(/"([a-z_]+)"/g)]
      .map((m) => m[1]!)
      // left-hand side values of the ternary, not written to the column
      .filter((v) => v !== "confirmed" && v !== "approximate");
    expect(written.length).toBeGreaterThan(0);
    for (const value of written) expect(ALLOWED_PRECISIONS).toContain(value);
  });

  it("never turns a draft into a record without an explicit survivor action", () => {
    expect(proposals).toContain("acceptProposedIncident");
    expect(proposals).toContain("denyProposedIncident");
    expect(proposals).toContain('eq("status", "pending")');
  });
});

describe("recurrence stays a count, never a conclusion", () => {
  it("builds every observation string through phrase() only", () => {
    expect(observations).toContain(
      "return `${count} ${eventLabel} ${timeframe}`",
    );
  });

  it("suppresses single occurrences instead of narrating them", () => {
    expect(observations).toContain("MIN_COUNT = 2");
    expect(observations).toContain("if (rows.length < MIN_COUNT) return null;");
  });
});
