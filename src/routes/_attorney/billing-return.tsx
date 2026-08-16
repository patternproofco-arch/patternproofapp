import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { trackEvent } from "@/lib/ga";
import { findTier, priceAmount } from "@/lib/pricing-tiers";

export const Route = createFileRoute("/_attorney/billing-return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const sub = useSubscription();
  const firedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => sub.refetch(), 2000);
    return () => clearInterval(t);
  }, [sub]);

  // Conversion event — fires exactly once per mount, on the first render
  // where the subscription reads as active.
  useEffect(() => {
    if (!sub.isActive || firedRef.current) return;
    firedRef.current = true;
    const tierKey = sub.tier === "firm" ? "attorney_firm" : sub.tier === "solo" ? "attorney_solo" : null;
    const amount = tierKey ? Number(priceAmount(findTier(tierKey)?.price ?? "")) : NaN;
    trackEvent("purchase", {
      ...(Number.isFinite(amount) && amount > 0 ? { value: amount } : {}),
      currency: "USD",
      tier: sub.tier,
    });
  }, [sub.isActive, sub.tier]);

  return (
    <div className="att-card" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
      <Check size={36} style={{ color: "var(--att-green)", margin: "0 auto 12px" }} />
      <h1 className="att-page-title">
        {sub.isActive ? "Subscription active" : "Finalizing your subscription…"}
      </h1>
      <p style={{ color: "var(--att-text-2)", fontSize: 14, marginBottom: 20 }}>
        {sub.isActive
          ? "You now have full access to every client case file."
          : "Stripe is confirming your payment. This usually takes a few seconds."}
      </p>
      <Link to="/clients" className="att-btn-secondary" style={{ display: "inline-block" }}>
        Go to clients
      </Link>
    </div>
  );
}