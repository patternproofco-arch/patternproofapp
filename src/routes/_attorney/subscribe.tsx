import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Lock, Star } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/subscribe")({
  component: SubscribePage,
});

type TierKey = "solo" | "firm" | "enterprise";
const TIERS: Record<TierKey, {
  name: string;
  price: string;
  cadence: string;
  priceId: string;
  recommended?: boolean;
  bullets: string[];
  close: string;
}> = {
  solo: {
    name: "Solo",
    price: "$297",
    cadence: "/month",
    priceId: "attorney_solo_monthly",
    bullets: [
      "One attorney seat",
      "Up to 10 active client matters",
      "Structured chronological timeline + pattern analysis",
      "Exportable case summary (ZIP) — Clio-compatible",
      "Private attorney notes per incident",
    ],
    close: "$297/month — one seat, up to 10 active matters.",
  },
  firm: {
    name: "Firm",
    price: "$697",
    cadence: "/month",
    priceId: "attorney_firm_monthly",
    recommended: true,
    bullets: [
      "Up to 3 attorneys on the same firm seat",
      "Unlimited active client matters",
      "Shared workspace for prep + escalation arcs",
      "Priority client onboarding support",
    ],
    close: "For small firms working DV and custody caseloads.",
  },
  enterprise: {
    name: "Enterprise",
    price: "$1,497",
    cadence: "/month",
    priceId: "attorney_enterprise_monthly",
    bullets: [
      "Full firm access. No attorney cap.",
      "White-label survivor portal",
      "SSO + dedicated support",
      "Direct line to the PatternProof team",
    ],
    close: "For firms that move volume.",
  },
};

function SubscribePage() {
  const sub = useSubscription();
  const [selected, setSelected] = useState<TierKey>("firm");

  if (sub.loading) {
    return <div className="att-card">Loading subscription…</div>;
  }

  if (sub.isActive) {
    return (
      <div className="att-card" style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
        <Check size={32} style={{ color: "var(--att-green)", margin: "0 auto 12px" }} />
        <h1 style={{ fontSize: 30, marginBottom: 8, fontFamily: '"Instrument Serif", serif', fontWeight: 400 }}>You're subscribed.</h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 14, marginBottom: 16 }}>
          Plan: PatternProof {sub.tier === "firm" ? "Firm" : sub.tier === "enterprise" ? "Enterprise" : "Solo"} · {sub.status}
          {sub.currentPeriodEnd && <> · renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</>}
        </p>
        <Link to="/clients" className="att-btn-secondary" style={{ display: "inline-block" }}>
          Open case files
        </Link>
      </div>
    );
  }

  const t = TIERS[selected];

  return (
    <div>
      <PaymentTestModeBanner />
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <div className="att-eyebrow">Attorney Portal · Pricing</div>
        <h1 style={{ fontSize: 36, marginTop: 4, marginBottom: 10, fontFamily: '"Instrument Serif", serif' }}>
          See the pattern before the hearing.
        </h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 15, maxWidth: 640 }}>
          Pick the plan that fits the firm. Ask us about the application-based
          Founding Pilot ($99/month for 90 days) if you're one of the first three
          family-law attorneys onboarding.
        </p>
      </div>

      {/* Grace's signature story — decisions happen here */}
      <div className="att-card" style={{ marginBottom: 28, background: "#FFFBEB", borderColor: "#FCD34D" }}>
        <div className="att-eyebrow" style={{ color: "#92400E" }}>From Grace, founder</div>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: "var(--att-text)", fontStyle: "italic" }}>
          "I documented everything. Nobody believed me anyway. I walked into that courtroom with folders of notes and screenshots and I still couldn't show the pattern. The judge couldn't see it. I built PatternProof because the evidence was always there — I just needed something that could show it."
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        {(Object.keys(TIERS) as TierKey[]).map((k) => {
          const tier = TIERS[k];
          const active = selected === k;
          return (
            <button
              key={k}
              onClick={() => setSelected(k)}
              className="att-card att-hover"
              style={{
                textAlign: "left",
                cursor: "pointer",
                border: active
                  ? "2px solid var(--att-navy)"
                  : tier.recommended
                    ? "2px solid var(--att-green)"
                    : "1px solid var(--att-border)",
                position: "relative",
                background: active ? "#F8FAFC" : "var(--att-surface)",
              }}
            >
              {tier.recommended && (
                <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-green)", color: "#fff", gap: 4, display: "inline-flex", alignItems: "center" }}>
                  <Star size={10} /> Recommended
                </span>
              )}
              <div className="att-eyebrow">{tier.name}</div>
              <div style={{ fontSize: 36, fontFamily: '"Instrument Serif", serif', marginTop: 4 }}>
                {tier.price}
                <span style={{ fontSize: 14, color: "var(--att-text-2)" }}>{tier.cadence}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8, fontSize: 13 }}>
                {tier.bullets.map((b) => (
                  <li key={b} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={14} style={{ color: "var(--att-green)", marginTop: 2, flexShrink: 0 }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 32, marginTop: 32 }}>
        <div>
          <div className="att-eyebrow">Selected: {t.name}</div>
          <h2 style={{ fontSize: 26, marginTop: 4, marginBottom: 8, fontFamily: '"Instrument Serif", serif' }}>
            {t.close}
          </h2>
          <p style={{ color: "var(--att-text-2)", fontSize: 14 }}>
            Cancel any time. Access continues through the paid period.
          </p>
          <div style={{ marginTop: 24, fontSize: 12, color: "var(--att-text-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={12} /> Secured by Stripe. Card details never touch our servers.
          </div>
        </div>
        <div className="att-card" style={{ padding: 0, overflow: "hidden" }}>
          <StripeEmbeddedCheckout priceId={t.priceId} />
        </div>
      </div>
    </div>
  );
}