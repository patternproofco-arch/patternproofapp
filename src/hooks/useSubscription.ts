import { useEffect, useId, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionState = {
  loading: boolean;
  isActive: boolean;
  status: string | null;
  priceId: string | null;
  tier: "core" | "court_ready" | "solo" | "firm" | "enterprise";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refetch: () => void;
};

function computeActive(row: {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null): boolean {
  if (!row) return false;
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const future = end === null || end > Date.now();
  if (["active", "trialing", "past_due"].includes(row.status) && future) return true;
  if (row.status === "canceled" && end && end > Date.now()) return true;
  return false;
}

/**
 * Realtime topics must be unique per subscribing instance: the Supabase client
 * keys channels by topic, so two mounts sharing one topic break the second
 * subscribe(). `instanceId` comes from React's useId.
 */
export function subscriptionChannelTopic(userId: string, instanceId: string): string {
  return `sub-${userId}-${instanceId.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export function useSubscription(): SubscriptionState {
  const fetcher = useServerFn(getMySubscription);
  // The /billing screen mounts this hook twice (once in the _attorney layout,
  // once in the page). Two Realtime channels sharing one topic makes the second
  // subscribe() fail ("tried to subscribe multiple times"), which surfaced as a
  // crash on that route. A per-instance suffix keeps the topics distinct.
  const instanceId = useId();
  const [row, setRow] = useState<Awaited<ReturnType<typeof getMySubscription>>["subscription"]>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    let env: ReturnType<typeof getStripeEnvironment>;
    try { env = getStripeEnvironment(); } catch { setLoading(false); return; }
    fetcher({ data: { environment: env } })
      .then((r) => setRow(r.subscription))
      .finally(() => setLoading(false));
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  // Keep the latest `load` in a ref so the realtime effect below depends only
  // on the user id. Otherwise a new `load` identity would tear down and
  // resubscribe the channel on every render.
  const loadRef = useRef(load);
  loadRef.current = load;

  // Resolve the user id first, in its own effect...
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => { active = false; };
  }, []);

  // ...so the channel is created synchronously here and its cleanup is the
  // effect's own return value (React only registers cleanups returned from the
  // effect body — a cleanup returned inside a .then() is silently dropped,
  // which left the channel subscribed and re-subscribed on every re-run).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(subscriptionChannelTopic(userId, instanceId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => loadRef.current(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, instanceId]);

  return {
    loading,
    isActive: computeActive(row),
    status: row?.status ?? null,
    priceId: row?.price_id ?? null,
    tier: deriveTier(row?.price_id ?? null, computeActive(row)),
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    refetch: load,
  };
}

function deriveTier(
  priceId: string | null,
  active: boolean,
): "core" | "court_ready" | "solo" | "firm" | "enterprise" {
  if (!active || !priceId) return "core";
  switch (priceId) {
    case "court_ready_monthly":
      return "court_ready";
    case "attorney_solo_monthly":
    case "attorney_portal_monthly_297":
      return "solo";
    case "attorney_firm_monthly":
    case "attorney_firm_charter_monthly":
      return "firm";
    case "attorney_enterprise_monthly":
      return "enterprise";
    default:
      return "core";
  }
}