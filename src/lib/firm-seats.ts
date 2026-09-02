import { FIRM_SEAT_MAX } from "@/lib/pricing-tiers";

export const FIRM_INCLUDED_SEATS = FIRM_SEAT_MAX;

const FIRM_PRICE_IDS = new Set([
  "attorney_firm_monthly",
  "attorney_firm_charter_monthly",
  "attorney_enterprise_monthly",
]);

export function firmSeatsForSubscription(input: {
  priceId: string | null | undefined;
  status: string | null | undefined;
  currentPeriodEnd?: string | number | null;
  now?: number;
}) {
  if (!input.priceId || !FIRM_PRICE_IDS.has(input.priceId)) return 0;
  const now = input.now ?? Date.now();
  const end =
    typeof input.currentPeriodEnd === "number"
      ? input.currentPeriodEnd * 1000
      : input.currentPeriodEnd
        ? new Date(input.currentPeriodEnd).getTime()
        : null;
  const withinPaidPeriod = end === null || (Number.isFinite(end) && end > now);
  const active =
    (["active", "trialing", "past_due"].includes(input.status ?? "") && withinPaidPeriod) ||
    (input.status === "canceled" && end !== null && end > now);
  return active ? FIRM_INCLUDED_SEATS : 0;
}
