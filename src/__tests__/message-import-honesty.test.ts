import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/**
 * A file type PatternProof cannot read must never be described as "coming shortly". Nothing reads it
 * later: it is kept as the original and no messages are added. The wording has to say exactly that.
 */
describe("message exports we cannot read are described truthfully", () => {
  const fns = read("lib/message-threads.functions.ts");
  const screen = read("routes/_authenticated/message-threads.tsx");

  it("no longer promises that a timeline will appear shortly", () => {
    expect(fns).not.toMatch(/in active development/);
    expect(fns).not.toMatch(/available in your timeline shortly/);
    expect(screen).not.toMatch(/in development/);
  });

  it("marks PDF, Excel, RSMF and ZIP uploads as saved but not read, not as queued", () => {
    expect(fns).toMatch(/status = "partial";\s*parseError =\s*"Saved as evidence\./);
    expect(fns).toMatch(/no messages were added/);
  });

  it("the upload cards say which formats are only kept as evidence", () => {
    expect(screen).toMatch(/It is not read into a searchable timeline yet/);
    expect(screen).toMatch(/Excel files are kept as evidence only/);
    expect(screen).toMatch(/Not read into a searchable timeline yet/);
  });

  it("WhatsApp exports are pointed to the importer that actually reads them", () => {
    expect(screen).toMatch(/to="\/import-messages"/);
    expect(screen).toMatch(/Link \}/);
  });
});
