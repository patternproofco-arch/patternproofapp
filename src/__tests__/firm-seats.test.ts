import { describe, expect, it } from "vitest";
import { FIRM_INCLUDED_SEATS, firmSeatsForSubscription } from "@/lib/firm-seats";

describe("firm seat entitlement", () => {
  const now = Date.parse("2026-08-23T12:00:00Z");

  it("includes fifteen seats with an active firm plan", () => {
    expect(
      firmSeatsForSubscription({
        priceId: "attorney_firm_monthly",
        status: "active",
        currentPeriodEnd: "2026-09-23T12:00:00Z",
        now,
      }),
    ).toBe(FIRM_INCLUDED_SEATS);
  });

  it("does not turn a solo subscription into a firm entitlement", () => {
    expect(
      firmSeatsForSubscription({
        priceId: "attorney_solo_monthly",
        status: "active",
        currentPeriodEnd: "2026-09-23T12:00:00Z",
        now,
      }),
    ).toBe(0);
  });

  it("honors a canceled plan only through its paid period", () => {
    expect(
      firmSeatsForSubscription({
        priceId: "attorney_firm_charter_monthly",
        status: "canceled",
        currentPeriodEnd: "2026-08-24T12:00:00Z",
        now,
      }),
    ).toBe(FIRM_INCLUDED_SEATS);
    expect(
      firmSeatsForSubscription({
        priceId: "attorney_firm_charter_monthly",
        status: "canceled",
        currentPeriodEnd: "2026-08-22T12:00:00Z",
        now,
      }),
    ).toBe(0);
  });
});
