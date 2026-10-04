import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("entries drafted by software keep unknown dates unknown and carry their provenance", () => {
  for (const f of ["src/components/AddFromJournalModal.tsx", "src/components/BulkPastIncidentsModal.tsx"]) {
    const src = readFileSync(f, "utf8");
    it(`${f}: no date found is not today, and the record says it was software-drafted`, () => {
      expect(src).not.toMatch(/: today\(\),?\s*$/m);
      expect(src).toMatch(/date_precision: (d\.date|date) \? "exact" : "unknown"/);
      expect(src).toContain('source: "ai_extracted"');
      expect(src).toContain("confirmed_at:");
    });
  }
  it("the bulk modal's only remaining use of today is the default end of a period picker", () => {
    const src = readFileSync("src/components/BulkPastIncidentsModal.tsx", "utf8");
    const uses = src.split("\n").filter((l) => l.includes("today()"));
    expect(uses.every((l) => /relend|const today/i.test(l))).toBe(true);
  });
});
