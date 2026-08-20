import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Check } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/billing-return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const sub = useSubscription();
  useEffect(() => {
    const t = setInterval(() => sub.refetch(), 2000);
    return () => clearInterval(t);
  }, [sub]);

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
