import { describe, expect, it } from "vitest";
import { isPaidThroughSubscription, pickPaidSubscription } from "@/lib/subscription-state";
const now = Date.parse("2026-10-11T12:00:00Z");
const future = "2026-10-12T12:00:00Z";
const past = "2026-10-10T12:00:00Z";
const plan = (price_id: string, status = "active", current_period_end: string | null = future) => ({
  price_id,
  status,
  current_period_end,
});
describe("subscription display matches effective billing", () => {
  it("a newly canceled plan does not hide another paid plan", () => {
    const paid = plan("attorney_firm_monthly");
    expect(pickPaidSubscription([plan("attorney_solo_monthly", "canceled", past), paid], now)).toBe(
      paid,
    );
  });
  it("picks the strongest current plan without mutating the query results", () => {
    const rows = [
      plan("attorney_solo_monthly"),
      plan("attorney_enterprise_monthly"),
      plan("attorney_firm_monthly"),
    ];
    expect(pickPaidSubscription(rows, now)).toBe(rows[1]);
    expect(rows[0].price_id).toBe("attorney_solo_monthly");
  });
  it("retains paid-through cancellation and past-due grace but rejects expired periods", () => {
    expect(isPaidThroughSubscription(plan("attorney_solo_monthly", "canceled"), now)).toBe(true);
    expect(isPaidThroughSubscription(plan("attorney_solo_monthly", "past_due"), now)).toBe(true);
    expect(pickPaidSubscription([plan("attorney_solo_monthly", "active", past)], now)).toBeNull();
    expect(isPaidThroughSubscription(plan("attorney_solo_monthly", "active", "invalid"), now)).toBe(
      false,
    );
  });
  it("a cancellation without a paid period cannot grant indefinite access", () => {
    expect(isPaidThroughSubscription(plan("attorney_solo_monthly", "canceled", null), now)).toBe(
      false,
    );
    expect(pickPaidSubscription([], now)).toBeNull();
  });
});
