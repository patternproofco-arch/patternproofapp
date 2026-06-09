import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/subscribe")({
  component: SubscribePage,
});

function SubscribePage() {
  const sub = useSubscription();

  if (sub.loading) {
    return <div className="att-card">Loading subscription…</div>;
  }

  if (sub.isActive) {
    return (
      <div className="att-card" style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
        <Check size={32} style={{ color: "var(--att-green)", margin: "0 auto 12px" }} />
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>You're subscribed.</h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 14, marginBottom: 16 }}>
          Plan: PatternProof Attorney Portal · {sub.status}
          {sub.currentPeriodEnd && <> · renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</>}
        </p>
        <Link to="/clients" className="att-btn-secondary" style={{ display: "inline-block" }}>
          Go to clients
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PaymentTestModeBanner />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 32, marginTop: 24 }}>
        <div>
          <div className="att-eyebrow">Subscription</div>
          <h1 style={{ fontSize: 32, marginTop: 4, marginBottom: 8 }}>PatternProof Attorney Portal</h1>
          <p style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif' }}>
            $297<span style={{ fontSize: 14, color: "var(--att-text-2)" }}> /month</span>
          </p>
          <p style={{ color: "var(--att-text-2)", fontSize: 14, marginTop: 12 }}>
            View one client free. Subscribe to unlock unlimited client case files.
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 20, display: "grid", gap: 10, fontSize: 14 }}>
            {[
              "Unlimited connected client case files",
              "Full client timeline + pattern analysis",
              "Escalation arc + risk scoring",
              "Court-ready ZIP packet (chain-of-custody)",
              "Private attorney notes per incident",
              "AI deposition prep generator",
              "Cancel any time — access until period end",
            ].map((f) => (
              <li key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Check size={16} style={{ color: "var(--att-green)", marginTop: 2, flexShrink: 0 }} /> {f}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 24, fontSize: 12, color: "var(--att-text-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={12} /> Secured by Stripe. Card details never touch our servers.
          </div>
        </div>
        <div className="att-card" style={{ padding: 0, overflow: "hidden" }}>
          <StripeEmbeddedCheckout priceId="attorney_portal_monthly_297" />
        </div>
      </div>
    </div>
  );
}