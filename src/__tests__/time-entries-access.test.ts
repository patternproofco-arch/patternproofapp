import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * time-entries.functions.ts had a parallel assertLinkAccess that only checked
 * status=active (no revoked_at / expiry). Guardian residual after #116:
 * reuse assertCaseAccess and honour the same deny rules in listMyAttorneyBilling.
 */
const src = readFileSync(resolve("src/lib/time-entries.functions.ts"), "utf8");

describe("time-entries access wiring", () => {
  it("assertLinkAccess reuses assertCaseAccess (no status-only parallel)", () => {
    expect(src).toContain("assertCaseAccess");
    // Local helper must not re-implement status=active-only owner lookup.
    const assertBlock = src.slice(
      src.indexOf("async function assertLinkAccess"),
      src.indexOf("export const listTimeEntries"),
    );
    expect(assertBlock).toContain("assertCaseAccess");
    expect(assertBlock).not.toMatch(/\.eq\(\s*["']status["']\s*,\s*["']active["']\s*\)/);
  });

  it("listMyAttorneyBilling selects revoked_at/expires_at and filters with isActiveShareLink", () => {
    const billing = src.slice(src.indexOf("export const listMyAttorneyBilling"));
    expect(billing).toContain("revoked_at");
    expect(billing).toContain("expires_at");
    expect(billing).toContain(".is(\"revoked_at\", null)");
    expect(billing).toContain("isActiveShareLink");
  });
});
