import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/routes/_authenticated/evidence.tsx", "utf8");

describe("the evidence page", () => {
  it("does not stamp today's date on a file", () => {
    expect(src).not.toMatch(/today\(\)/);
    expect(src).not.toMatch(/useState\(today/);
  });
  it("makes the date optional and keeps upload time separate", () => {
    expect(src).toContain("Date (optional)");
    expect(src).not.toMatch(/type="date"[\s\S]{0,80}required/);
    expect(src).toMatch(/uploaded it is recorded separately/);
  });
  it("uploads through the one intake, which confirms a record exists", () => {
    expect(src).toContain("uploadAndPreserve");
    expect(src).not.toMatch(/storage\.from\("evidence-files"\)\.upload\(key, pending\)/);
  });
  it("reuses the storage name when an outcome was unknown, so retrying can't duplicate", () => {
    expect(src).toContain("resumeKey");
    expect(src).toMatch(/intake\.stage === "unconfirmed" \? intake\.storageKey : null/);
  });
  it("an entry made from a file carries no invented date and says so if the link failed", () => {
    expect(src).toMatch(/date: draft\.date \?\? null/);
    expect(src).toMatch(/date_precision: draft\.date \? "exact" : "unknown"/);
    expect(src).toContain("link.error");
    expect(src).toMatch(/couldn't link it to this file/);
    expect(src).not.toMatch(/Mark saved and linked to this evidence/);
  });
  it("a failed read does not empty the screen", () => {
    expect(src).toMatch(/if \(ev\.error\)/);
  });
});
