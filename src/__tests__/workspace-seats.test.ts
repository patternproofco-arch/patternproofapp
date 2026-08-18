import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { FIRM_INCLUDED_SEATS, FIRM_MAX_SEATS, SEAT_PRICE_CENTS, SEAT_PRICE_LOOKUP_KEY } from "@/lib/workspace-seats";
import { CHARTER_COHORT_CAP } from "@/lib/pricing-tiers";

describe("firm workspace seats", () => {
  it("includes 3 seats and caps a workspace at 10 people", () => {
    expect(FIRM_INCLUDED_SEATS).toBe(3);
    expect(FIRM_MAX_SEATS).toBe(10);
  });

  it("prices an additional seat at $99/month", () => {
    expect(SEAT_PRICE_CENTS).toBe(9900);
    expect(SEAT_PRICE_LOOKUP_KEY).toBe("attorney_seat_monthly");
  });

  it("keeps the per-firm seat cap separate from the Charter cohort cap", () => {
    // Same number, different meaning — the Charter cap counts customers.
    const charterGuard = readFileSync(join(process.cwd(), "src/lib/payments.functions.ts"), "utf8");
    expect(charterGuard).toContain("getCharterAvailability");
    expect(CHARTER_COHORT_CAP).toBe(10);
    expect(charterGuard).not.toContain("FIRM_MAX_SEATS >= ");
  });
});

describe("workspace visibility helpers", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/workspace.server.ts"), "utf8");

  it("returns no peers when the caller belongs to no workspace", () => {
    expect(src).toContain("if (!membership) return [];");
  });

  it("scopes peers to a single firm or org id", () => {
    expect(src).toContain('.eq("firm_id", membership.firm_id)');
    expect(src).toContain('.eq("org_id", membership.org_id)');
  });
});
