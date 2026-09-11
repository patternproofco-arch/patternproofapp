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
          "PatternProof pricing: free for survivors. Solo attorney $297/mo. Firm plan $897/mo, with a Charter Firm rate of $597/mo locked for 12 months.",
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
    a: "We're onboarding Charter Firms personally — full setup, case import, and staff training. Every Charter Firm gets the same terms: $597/month, locked for 12 months. After 12 months, the rate moves to the standard Firm price of $897/month and we'll notify you at least 60 days in advance.",
  },
  {
    q: "How is the Firm tier different from Solo?",
    a: `Firm includes a shared workspace for up to ${FIRM_SEAT_MAX} separate verified team logins. Owners and administrators invite members, and lawyers receive access to each survivor matter only through an explicit case grant. Solo is limited to one attorney login. Matter counts are not currently metered.`,
  },
  {
    q: "Why don't you sell to DV organizations?",
    a: "Organizations are our referral partners, not our customers. Every survivor a partner organization refers to PatternProof gets full access at no cost — no cost to the organization or the survivor.",
  },
  {
    q: "Does this work with my practice management system?",
    a: "There is no live sync. Attorney plans include a ZIP export of standard CSVs plus every evidence file.",
  },
  {
    q: "Is my data safe?",
    a: "All data is encrypted in transit (HTTPS/TLS) and scoped to its owning account by row-level security. We do not currently offer end-to-end (zero-knowledge) encryption.",
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
      /* preview without stripe */
    }
  }, []);
  const tiers = buildTiers(remaining);
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <PublicQuickExit />
      <header style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <Link to="/">Home</Link>
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 120px" }}>
        <h1>Pattern is evidence.</h1>
        <p>Survivors free. Attorneys pay for a workspace. Organizations partner at no cost.</p>
        <ThreadGroup persona="shared" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {tiers.map((tier) => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </ThreadGroup>
        <div style={{ maxWidth: 720, margin: "48px auto 0" }}>
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} {...faq} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div className="card-pp" style={{ padding: 28 }}>
      <div>{tier.name}</div>
      <div>{tier.price} {tier.sub}</div>
      <p>{tier.quote}</p>
      <ul>{tier.features.map((f) => <li key={f}>{f}</li>)}</ul>
      <Link to={tier.ctaTo}>{tier.cta}</Link>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="card-pp" style={{ padding: 16, marginBottom: 12 }}>
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  );
}
