type Subscription = {
  status: string;
  price_id: string | null;
  current_period_end: string | null;
};

export function isPaidThroughSubscription(
  row: Pick<Subscription, "status" | "current_period_end"> | null,
  now = Date.now(),
): boolean {
  if (!row) return false;
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  if (["active", "trialing", "past_due"].includes(row.status)) return end === null || end > now;
  return row.status === "canceled" && end !== null && end > now;
}

const PLAN_RANK: Record<string, number> = {
  court_ready_monthly: 1,
  attorney_solo_monthly: 2,
  attorney_portal_monthly_297: 2,
  attorney_firm_monthly: 3,
  attorney_firm_charter_monthly: 3,
  attorney_enterprise_monthly: 4,
};

/** Rows arrive newest first. Keep the strongest paid plan, retaining that order for ties. */
export function pickPaidSubscription<T extends Subscription>(
  rows: readonly T[],
  now = Date.now(),
): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (!isPaidThroughSubscription(row, now)) continue;
    if (!best || (PLAN_RANK[row.price_id ?? ""] ?? 0) > (PLAN_RANK[best.price_id ?? ""] ?? 0))
      best = row;
  }
  return best;
}
