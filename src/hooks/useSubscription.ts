import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

// useSubscription() is called from more than one component at once for the
// same signed-in attorney — the portal layout (for the paywall gate) and
// individual pages (clients.index.tsx, billing.tsx, subscribe.tsx, etc.)
// each call it independently. Supabase's realtime client reuses the same
// channel object for a given topic name, so a second, unrelated
// `.channel("sub-<userId>").on(...)` call — from the second component's own
// effect — throws ("cannot add postgres_changes callbacks... after
// subscribe()") because that channel is already subscribed. Dedupe to one
// real channel per user, ref-counted across every hook instance watching it.
const subscriptionChannels = new Map<
  string,
  { channel: RealtimeChannel; refCount: number; listeners: Set<() => void> }
>();

function watchSubscriptionChanges(userId: string, onChange: () => void): () => void {
  let entry = subscriptionChannels.get(userId);
  if (!entry) {
    const listeners = new Set<() => void>();
    const channel = supabase
      .channel(`sub-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => listeners.forEach((l) => l()),
      )
      .subscribe();
    entry = { channel, refCount: 0, listeners };
    subscriptionChannels.set(userId, entry);
  }
  entry.refCount += 1;
  entry.listeners.add(onChange);
  return () => {
    entry.listeners.delete(onChange);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      supabase.removeChannel(entry.channel);
      subscriptionChannels.delete(userId);
    }
  };
}

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

export function useSubscription(): SubscriptionState {
  const fetcher = useServerFn(getMySubscription);
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

  // ...so the subscription is registered synchronously here and its cleanup
  // is the effect's own return value (React only registers cleanups returned
  // from the effect body — a cleanup returned inside a .then() is silently
  // dropped, which left the channel subscribed and re-subscribed on every
  // re-run). See watchSubscriptionChanges above for why this shares one real
  // channel across every useSubscription() instance for the same user.
  useEffect(() => {
    if (!userId) return;
    return watchSubscriptionChanges(userId, () => loadRef.current());
  }, [userId]);

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