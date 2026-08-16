import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Lock, Star } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { buildTiers, CHARTER_COHORT_CAP, findTier, type Tier } from "@/lib/pricing-tiers";
import { trackEvent } from "@/lib/ga";

export const Route = createFileRoute("/_attorney/subscribe")({
  component: SubscribePage,
});

type TierKey = "solo" | "firm_charter" | "firm";

type CheckoutTier = {
  name: string;
  price: string;
  priceStrike?: string;
  cadence: string;
  priceId: string;
  recommended?: boolean;
  bullets: string[];
  close: string;
  note?: string;
};

const PRICE_IDS: Record<TierKey, string> = {
  solo: "attorney_solo_monthly",
  firm_charter: "attorney_firm_charter_monthly",
  firm: "attorney_firm_monthly",
};

/**
 * Checkout tiers are derived from src/lib/pricing-tiers.ts so this page — the
 * real Stripe entry point — can never drift from /pricing. The Charter and
 * list Firm cards come from the two buildTiers() variants (remaining > 0 vs.
 * cohort full); only the Stripe price IDs live here.
 */
function toCheckoutTier(key: TierKey, tier: Tier | undefined): CheckoutTier | null {
  if (!tier) return null;
  return {
    name: tier.name,
    price: tier.price,
    priceStrike: tier.priceStrike,
    cadence: tier.sub,
    priceId: PRICE_IDS[key],
    recommended: key === "firm_charter",
    bullets: tier.features,
    close: tier.quote,
    note: key === "firm_charter" ? tier.eyebrowNote : undefined,
  };
}

function buildCheckoutTiers(remaining: number | null): Partial<Record<TierKey, CheckoutTier>> {
  const withCharter = buildTiers(remaining !== null && remaining <= 0 ? 1 : remaining);
  const charterFullTiers = buildTiers(0);
  return {
    solo: toCheckoutTier("solo", findTier("attorney_solo", withCharter)) ?? undefined,
    firm_charter: toCheckoutTier("firm_charter", findTier("attorney_firm", withCharter)) ?? undefined,
    firm: toCheckoutTier("firm", findTier("attorney_firm", charterFullTiers)) ?? undefined,
  };
}

function SubscribePage() {
  const sub = useSubscription();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [selected, setSelected] = useState<TierKey>("firm_charter");

  useEffect(() => {
    let env: ReturnType<typeof getStripeEnvironment>;
    try { env = getStripeEnvironment(); } catch { return; }
    getCharterAvailability({ data: { environment: env } })
      .then((r) => {
        setRemaining(r.remaining);
        if (r.remaining <= 0) setSelected("firm");
      })
      .catch(() => {});
  }, []);

  if (sub.loading) {
    return <div className="att-card">Loading subscription…</div>;
  }

  if (sub.isActive) {
    return (
      <div className="att-card" style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
        <Check size={32} style={{ color: "var(--att-green)", margin: "0 auto 12px" }} />
        <h1 className="att-page-title">You're subscribed.</h1>
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

  const charterFull = remaining !== null && remaining <= 0;
  const visibleKeys: TierKey[] = charterFull
    ? ["solo", "firm"]
    : ["solo", "firm_charter", "firm"];
  const tiers = buildCheckoutTiers(remaining);
  const t = tiers[selected] ?? tiers.solo;
  if (!t) return <div className="att-card">Loading plans…</div>;

  return (
    <div>
      <PaymentTestModeBanner />
      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <div className="att-eyebrow">Attorney Portal · Pricing</div>
        <h1 className="att-page-title">
          See the pattern before the hearing.
        </h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 15, maxWidth: 640 }}>
          Pick the plan that fits the firm.{" "}
          {charterFull
            ? `The Charter Firm cohort is full — thank you to the founding ${CHARTER_COHORT_CAP}.`
            : remaining !== null
              ? `Charter program: personal setup and ${tiers.firm_charter?.price ?? ""}/month locked for 12 months — ${remaining} of ${CHARTER_COHORT_CAP} spots remaining.`
              : `Charter program: personal setup and ${tiers.firm_charter?.price ?? ""}/month locked for 12 months — first ${CHARTER_COHORT_CAP} firms only.`}
        </p>
      </div>

      {/* Grace's signature story — decisions happen here */}
      <div className="att-card" style={{ marginBottom: 28, background: "#FFFFFF", borderColor: "var(--att-border-strong)" }}>
        <div className="att-eyebrow" style={{ color: "var(--att-text-2)" }}>From Grace, founder</div>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: "var(--att-text)", fontStyle: "italic" }}>
          "I documented everything. Nobody believed me anyway. I walked into that courtroom with folders of notes and screenshots and I still couldn't show the pattern. The judge couldn't see it. I built PatternProof because the evidence was always there — I just needed something that could show it."
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleKeys.length}, minmax(0, 1fr))`, gap: 16 }}>
        {visibleKeys.map((k) => {
          const tier = tiers[k];
          if (!tier) return null;
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
                background: active ? "var(--att-surface-2)" : "var(--att-surface)",
              }}
            >
              {tier.recommended && (
                <span className="att-tag" style={{ position: "absolute", top: 12, right: 12, background: "var(--att-green)", color: "#fff", gap: 4, display: "inline-flex", alignItems: "center" }}>
                  <Star size={10} /> Recommended
                </span>
              )}
              <div className="att-eyebrow">{tier.name}</div>
              <div style={{ fontSize: 36, fontFamily: "\"Space Grotesk\", system-ui, sans-serif", marginTop: 4 }}>
                {tier.priceStrike && (
                  <span style={{ fontSize: 18, color: "var(--att-text-2)", textDecoration: "line-through", marginRight: 8, fontFamily: "inherit" }}>
                    {tier.priceStrike}
                  </span>
                )}
                {tier.price}
                <span style={{ fontSize: 14, color: "var(--att-text-2)" }}>{tier.cadence}</span>
              </div>
              {tier.note && (
                <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 4, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {tier.note}
                </div>
              )}
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
          <h2 style={{ fontSize: 26, marginTop: 4, marginBottom: 8, fontFamily: "\"Space Grotesk\", system-ui, sans-serif" }}>
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