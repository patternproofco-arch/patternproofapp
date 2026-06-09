import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionState = {
  loading: boolean;
  isActive: boolean;
  status: string | null;
  priceId: string | null;
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

  useEffect(() => {
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      const channel = supabase
        .channel(`sub-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` }, () => load())
        .subscribe();
      // cleanup
      return () => { supabase.removeChannel(channel); };
    });
  }, [load]);

  return {
    loading,
    isActive: computeActive(row),
    status: row?.status ?? null,
    priceId: row?.price_id ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    refetch: load,
  };
}