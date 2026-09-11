import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { Check, ArrowRight, HelpCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark, MARK_COLORWAYS } from "@/components/BrandMark";
import { BrandLogo } from "@/components/BrandLogo";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { buildTiers, FIRM_SEAT_MAX, type Tier } from "@/lib/pricing-tiers";
import { ThreadGroup } from "@/components/ThreadConnector";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "PatternProof — Pricing" },
      {
        name: "description",
        content:
          "Free for survivors. Solo attorney $297/mo. Firm $897/mo, Charter $597/mo locked 12 months.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/pricing" }],
  }),
  component: PricingPage,
});

const FAQS = [
  {
    q: "Is it really free for survivors?",
    a: "Yes. No credit card, no trial, no catch. Survivors do not pay — documenting, sharing with an attorney or advocate, and the first professional-review packet are free. Attorneys pay for their own workspace.",
  },
  {
    q: "What's the Charter Firm program?",
    a: `We're onboarding Charter Firms personally. $597/month locked for 12 months, then $897/month. Up to ${FIRM_SEAT_MAX} seats.`,
  },
  {
    q: "How is Firm different from Solo?",
    a: `Firm is a shared workspace for up to ${FIRM_SEAT_MAX} logins. Solo is one attorney. Matter counts are not metered.`,
  },
  {
    q: "Why don't you sell to DV organizations?",
    a: "Organizations are referral partners. Survivors they refer get full access at no cost to the org or the survivor.",
  },
];

function PricingPage() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    try {
      const env = getStripeEnvironment();
      getCharterAvailability({ data: { environment: env } })
        .then((r) => setRemaining(r.remaining))
        .catch(() => setRemaining(null));
    } catch {
      /* preview */
    }
  }, []);
  const tiers = buildTiers(remaining);
  return (
    <div className="folio-page" style={{ minHeight: "100vh", background: "var(--paper, #f4f1ea)" }}>
      <PublicQuickExit />
      <header style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
          <ArrowLeft size={16} /> Home
        </Link>
        <BrandLogo size={36} showTagline={false} />
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 120px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontFamily: "Newsreader, Georgia, serif", fontWeight: 400, fontSize: "clamp(2rem,5vw,3.2rem)" }}>
            Pattern is evidence.
          </h1>
          <p style={{ color: "var(--ink-muted, #5c574f)" }}>
            Survivors free. Attorneys pay for a workspace. Organizations partner at no cost.
          </p>
        </div>
        <ThreadGroup
          persona="shared"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 80,
          }}
        >
          {tiers.map((tier) => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </ThreadGroup>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {FAQS.map((faq) => (
            <details key={faq.q} className="card-pp" style={{ padding: 18, marginBottom: 12 }}>
              <summary style={{ fontWeight: 700, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
                <HelpCircle size={16} /> {faq.q}
              </summary>
              <p style={{ margin: "12px 0 0 26px", color: "var(--ink-muted, #5c574f)" }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </main>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const isAttorney = tier.key === "attorney_solo" || tier.key === "attorney_firm";
  const isOrg = tier.key === "organization";
  const attorneyAccent = MARK_COLORWAYS.attorney.solid!;
  const orgAccent = MARK_COLORWAYS.advocate.solid!;
  const cardBg = isAttorney ? attorneyAccent : "var(--paper-deep, #ebe6dc)";
  const textColor = isAttorney ? "#fff" : "var(--ink, #1a1916)";
  const muted = isAttorney ? "rgba(255,255,255,0.72)" : "var(--ink-muted, #5c574f)";
  const ctaBg = isAttorney ? "#fff" : isOrg ? orgAccent : "var(--ink, #1a1916)";
  const ctaColor = isAttorney ? attorneyAccent : "#fff";
  return (
    <div style={{ background: cardBg, borderRadius: 3, padding: 28, border: "1px solid #d4cfc4" }}>
      <BrandMark size={40} onDark={isAttorney} variant={isAttorney ? "attorney" : isOrg ? "advocate" : "survivor"} />
      <div style={{ marginTop: 12, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: isAttorney ? "#fff" : undefined }}>
        {tier.name}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: textColor }}>
        {tier.priceStrike && (
          <span style={{ fontSize: 16, textDecoration: "line-through", marginRight: 8, opacity: 0.7 }}>{tier.priceStrike}</span>
        )}
        {tier.price}
        <span style={{ fontSize: 14, fontWeight: 500, color: muted }}> {tier.sub}</span>
      </div>
      <p style={{ color: muted, fontStyle: "italic" }}>{tier.quote}</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", gap: 8, color: muted, fontSize: 14, marginBottom: 8 }}>
            <Check size={16} /> {f}
          </li>
        ))}
      </ul>
      {tier.ctaTo.startsWith("mailto") ? (
        <a href={tier.ctaTo} className="btn-primary" style={{ display: "inline-flex", gap: 8, background: ctaBg, color: ctaColor, borderRadius: 3, padding: "10px 16px", textDecoration: "none" }}>
          {tier.cta} <ArrowRight size={14} />
        </a>
      ) : (
        <Link to={tier.ctaTo} className="btn-primary" style={{ display: "inline-flex", gap: 8, background: ctaBg, color: ctaColor, borderRadius: 3, padding: "10px 16px", textDecoration: "none" }}>
          {tier.cta} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
