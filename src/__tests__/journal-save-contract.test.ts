import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contracts on the journal screen's source. They don't render it (no browser here); they pin
 * the rules that must stay true so a later edit can't quietly bring the old behavior back.
 */
const src = readFileSync("src/routes/_authenticated/journal.tsx", "utf8");

describe("dates", () => {
  it("never fills in today's date on her behalf", () => {
    expect(src).not.toMatch(/today\(\)/);
    expect(src).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  });
  it("stores exactly what she gave, through one shared rule", () => {
    expect(src).toContain("resolveIncidentDate");
    expect(src).toContain("dateFormFromRow");
    expect(src).toContain("EMPTY_DATE_FORM");
  });
  it("lets her leave the date out", () => {
    expect(src).toContain("Not sure yet");
    expect(src).toMatch(/saved without a date/i);
  });
});

describe("what is required", () => {
  it("needs only words (or a file): no type, no date", () => {
    expect(src).not.toMatch(/abuse_types\.length === 0/);
    expect(src).not.toMatch(/at least one type/i);
    expect(src).toContain("Type (optional)");
  });
  it("puts the extra details under 'Add details later'", () => {
    expect(src).toContain("Add details later");
    const details = src.slice(src.indexOf("Add details later"));
    for (const field of ["entry-time", "entry-location", "entry-witnesses", "entry-impact"]) {
      expect(details).toContain(field);
    }
  });
  it("says saving is private and sharing is separate", () => {
    expect(src).toMatch(/Save privately/);
    expect(src).toMatch(/Sharing with anyone is a separate step/);
  });
});

describe("saving tells the truth", () => {
  it("attaches files through the one intake that confirms a record exists, not a direct insert", () => {
    expect(src).toContain("uploadAndPreserve");
    expect(src).not.toMatch(/from\("evidence"\)\s*\.insert/);
    expect(src).not.toMatch(/from\("evidence"\)\.insert/);
  });
  it("reports failed files as NOT saved, keeps the entry editable and retries only those", () => {
    expect(src).toContain("did NOT save");
    expect(src).toContain("setEditingId(savedId)");
    expect(src).toContain("setAttachments(outcome.failed.map");
    // The failure branch returns before the success message is ever produced.
    const failure = src.indexOf("outcome.failed.length > 0");
    const success = src.indexOf("Saved privately.");
    expect(failure).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(failure);
    expect(src.slice(failure, success)).toContain("return;");
  });
  it("only removes the unfinished-entry copy after the save is confirmed", () => {
    const failure = src.indexOf("outcome.failed.length > 0");
    expect(src.slice(0, failure)).toMatch(/if \(error\) \{[\s\S]*?return;\s*\}/);
    expect(src.indexOf("entryDraft.clear()", failure)).toBeGreaterThan(failure);
  });
  it("a failed list read says so instead of showing an empty journal", () => {
    expect(src).toContain("loadError");
    expect(src).toMatch(/couldn(&apos;|')t load your entries/i);
  });
});

describe("unfinished entries", () => {
  it("are kept privately in her account, and never in browser storage", () => {
    expect(src).toContain("useEntryDraft");
    expect(src).not.toMatch(/localStorage|sessionStorage/);
  });
  it("show what the draft is doing, and only claim 'saved' via the hook's status", () => {
    expect(src).toContain("draftStatusText(entryDraft.status)");
  });
  it("surfaces a failed draft load instead of pretending there is no draft", () => {
    expect(src).toContain("entryDraft.loadFailed");
    expect(src).toContain("draft-load-failed");
  });
  it("wait for her to choose before showing old text, and let her discard it", () => {
    expect(src).toContain("Continue it");
    expect(src).toContain("Discard it");
  });
});

describe("accessibility basics on the form", () => {
  it("labels are tied to their fields", () => {
    for (const id of ["entry-what", "entry-files", "entry-date", "entry-location", "entry-witnesses"]) {
      expect(src).toContain(`htmlFor="${id}"`);
      expect(src).toContain(`id="${id}"`);
    }
  });
  it("toggle buttons expose their state", () => {
    expect(src).toMatch(/aria-pressed=\{o\.on\}/);
  });
});
