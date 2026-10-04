import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isMissingReadinessColumn } from "@/lib/sharing/share-readiness";

describe("only a missing column counts as 'column missing'", () => {
  it("recognizes the real shapes", () => {
    expect(isMissingReadinessColumn({ code: "42703", message: 'column "share_readiness" does not exist' })).toBe(true);
    expect(isMissingReadinessColumn({ message: "column incidents.share_readiness does not exist" })).toBe(true);
  });
  it("treats every other failure as a failure", () => {
    expect(isMissingReadinessColumn({ message: "connection reset" })).toBe(false);
    expect(isMissingReadinessColumn({ message: "JWT expired", code: "PGRST301" })).toBe(false);
    expect(isMissingReadinessColumn({ message: "permission denied for table incidents" })).toBe(false);
    expect(isMissingReadinessColumn(null)).toBe(false);
    expect(isMissingReadinessColumn(undefined)).toBe(false);
  });
});

describe("the invitation screen does not widen on a read error", () => {
  const src = readFileSync("src/routes/survivor-invite.$token.tsx", "utf8");

  it("falls back to the plain query only when the column is missing", () => {
    const loader = src.slice(src.indexOf("const loadIncidents"), src.indexOf("Promise.all(["));
    expect(loader).toContain("isMissingReadinessColumn(withReadiness.error)");
    expect(loader.indexOf("throw withReadiness.error")).toBeGreaterThan(-1);
    expect(loader.indexOf("throw withReadiness.error")).toBeLessThan(loader.indexOf("const plain"));
  });

  it("stops and says so instead of retrying in a loop or showing an empty, selectable list", () => {
    expect(src).toContain("scopeLoadFailed");
    expect(src).toMatch(/nothing is selected/);
  });

  it("keeps entries with an unknown date in the list", () => {
    expect(src).not.toMatch(/\(r\): r is typeof r & \{ date: string \} => !!r\.date/);
    expect(src).toContain('"Date not known"');
  });

  it("a failed file read stops the screen too", () => {
    expect(src).toContain("if (ev.error) throw ev.error");
  });
});

describe("a failed history read is not reported as 'nobody looked'", () => {
  it("the server throws and the page says it couldn't load", () => {
    const fn = readFileSync("src/lib/survivor-access.functions.ts", "utf8");
    const audit = fn.slice(fn.indexOf("listMyAccessAudit"), fn.indexOf("listPendingAdvocateInvitesForMe"));
    expect(audit).toContain("throw new Error");
    expect(audit).not.toMatch(/if \(error\) \{\s*return \{ events: \[\]/);
    const page = readFileSync("src/routes/_authenticated/access.tsx", "utf8");
    expect(page).toContain("auditFailed");
    expect(page).not.toMatch(/\.catch\(\(\) => setAudit\(\[\]\)\)/);
  });
});

describe("revoking explains what it can't undo", () => {
  it("says copies already saved or downloaded stay with the professional", () => {
    const page = readFileSync("src/routes/_authenticated/access.tsx", "utf8");
    expect(page).toMatch(/already saved or downloaded stays with them/);
  });
});
