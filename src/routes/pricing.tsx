import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { Check, ArrowRight, HelpCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark, MARK_COLORWAYS } from "@/components/BrandMark";
import { BrandLogo } from "@/components/BrandLogo";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { buildTiers, FIRM_SEAT_MAX, type Tier } from "@/lib/pricing-tiers";
import { ThreadConnector } from "@/components/ThreadConnector";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "PatternProof — Pricing" },
      {
        name: "description",
        content:
          "PatternProof pricing: free for survivors. Solo attorney $297/mo. Firm plan $897/mo, with a Charter Firm rate of $597/mo locked for 12 months for the first 10 firms.",
      },
      { property: "og:title", content: "Pricing — PatternProof" },
      {
        property: "og:description",
        content:
          "Free for survivors. Firm pricing for family-law practices. DV organizations partner with us at no cost.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/pricing" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

const FAQS = [
  {
    q: "Is it really free for survivors?",
    a: "Yes. No credit card, no trial, no catch. Survivors do not pay today — and that includes the professional-review packet export and sharing your case with an attorney. There's an optional one-time contribution (any amount, $1–$500) if PatternProof helped you — it doesn't unlock anything; every survivor feature is already free.",
  },
  {
    q: "What's the Charter Firm program?",
    a: "We're onboarding the first 10 Charter Firms personally — full setup, case import, and staff training. Every Charter Firm gets the same terms: $597/month, locked for 12 months. After 12 months, the rate moves to the standard Firm price of $897/month and we'll notify you at least 60 days in advance.",
  },
  {
    q: "How is the Firm tier different from Solo?",
    a: `Firm includes a shared workspace for up to ${FIRM_SEAT_MAX} separate verified team logins. Owners and administrators invite members, and lawyers receive access to each survivor matter only through an explicit case grant. Solo is limited to one attorney login. Matter counts are not currently metered.`,
  },
  {
    q: "Why don't you sell to DV organizations?",
    a: "Organizations are our referral partners, not our customers. Every survivor a partner organization refers to PatternProof gets full access at no cost — no cost to the organization or the survivor. We work directly with a small number of organizations at a time so we can support your advocates properly.",
  },
  {
    q: "Does this work with my practice management system?",
    a: "There is no live sync. Attorney plans include a ZIP export of standard CSVs plus every evidence file, which you can import into the practice management system you already use. Organization/advocate accounts currently get a plain-text case summary export, not a ZIP.",
  },
  {
    q: "Is my data safe?",
    a: "All data is encrypted in transit (HTTPS/TLS) and scoped to its owning account by row-level security. At-rest encryption is provided by our infrastructure host as part of their platform; we have not independently audited that configuration. We do not currently offer end-to-end (zero-knowledge) encryption — if that's a hard requirement for you, tell us.",
  },
];

function PricingPage() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    let env: ReturnType<typeof getStripeEnvironment>;
    try {
      env = getStripeEnvironment();
    } catch {
      return;
    }
    getCharterAvailability({ data: { environment: env } })
      .then((r) => setRemaining(r.remaining))
      .catch(() => setRemaining(null));
  }, []);
  const tiers = buildTiers(remaining);
  return (
    <div data-persona="shared" style={{ minHeight: "100vh", background: "var(--background)" }}>
      <PublicQuickExit />
      <header
        style={{
          padding: "20px 24px",
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--muted-foreground)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Home
        </Link>
        <BrandLogo size={36} showTagline={false} />
      </header>

      <main
        className="app-surface"
        style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 120px" }}
      >
        {/* Trust line */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(20,23,31,0.08)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#3D3832",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 18,
                background: "var(--pp-accent-shared, var(--oxblood-deep))",
              }}
            />
            Simple, transparent pricing
          </div>
          <h1
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginBottom: 16,
            }}
          >
            Pattern is evidence.
            <br />
            <span
              style={{
                background: "var(--pp-accent)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Pricing should never be a barrier to safety.
            </span>
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "#6E6579",
              maxWidth: 520,
              margin: "0 auto",
              fontWeight: 500,
            }}
          >
            Choose the plan that fits your role. Every tier is built with the same privacy-first
            architecture.
          </p>
        </div>

        {/* Cards */}
        <ThreadConnector orientation="vertical-behind">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 24,
              marginBottom: 100,
              alignItems: "start",
            }}
          >
            {tiers.map((tier) => (
              <TierCard key={tier.key} tier={tier} />
            ))}
          </div>
        </ThreadConnector>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              Frequently asked questions
            </h2>
            <p style={{ fontSize: 15, color: "var(--muted-foreground)" }}>
              The questions we hear most.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAQS.map((faq, i) => (
              <FAQItem key={i} {...faq} />
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          <Link
            to="/"
            style={{
              color: "var(--foreground)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Home
          </Link>
          <span style={{ margin: "0 12px", opacity: 0.4 }}>·</span>
          <Link
            to="/privacy"
            style={{
              color: "var(--foreground)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Privacy Policy
          </Link>
          <span style={{ margin: "0 12px", opacity: 0.4 }}>·</span>
          <span>© {new Date().getFullYear()} PatternProof</span>
        </p>
      </footer>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const isAttorney = tier.key === "attorney_solo" || tier.key === "attorney_firm";
  const isOrg = tier.key === "organization";

  const attorneyAccent = MARK_COLORWAYS.attorney.solid!;
  const orgAccent = MARK_COLORWAYS.advocate.solid!;

  const cardBg = isAttorney ? attorneyAccent : "var(--pp-card)";
  const border = "none";

  const textColor = isAttorney ? "#FFFFFF" : "var(--pp-ink)";
  const mutedColor = isAttorney ? "rgba(255,255,255,0.72)" : "var(--pp-muted)";
  const checkColor = isAttorney ? "#FFFFFF" : isOrg ? orgAccent : "var(--pp-accent)";
  const eyebrowColor = isAttorney ? "#FFFFFF" : isOrg ? orgAccent : "var(--pp-accent)";

  const ctaBg = isAttorney ? "#FFFFFF" : isOrg ? orgAccent : "var(--pp-accent)";
  const ctaColor = isAttorney ? attorneyAccent : "#FFFFFF";

  return (
    <div
      style={{
        background: cardBg,
        border,
        borderRadius: 18,
        padding: 36,
        boxShadow: "var(--pp-shadow-sm)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {tier.featured && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: attorneyAccent,
            color: "#FAF8F4",
            padding: "6px 16px",
            borderRadius: 18,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Recommended
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <BrandMark
          size={44}
          onDark={isAttorney}
          variant={isAttorney ? "attorney" : isOrg ? "advocate" : "survivor"}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: eyebrowColor,
          marginBottom: 10,
        }}
      >
        {tier.name}
      </div>

      <div style={{ marginBottom: 8 }}>
        {tier.priceStrike && (
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: mutedColor,
              textDecoration: "line-through",
              marginRight: 8,
              opacity: 0.7,
            }}
          >
            {tier.priceStrike}
          </span>
        )}
        <span
          style={{
            fontSize: "clamp(2rem, 3.5vw, 2.6rem)",
            fontWeight: 800,
            color: textColor,
            letterSpacing: "-0.02em",
          }}
        >
          {tier.price}
        </span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: mutedColor,
            marginLeft: 4,
          }}
        >
          {tier.sub}
        </span>
        {tier.eyebrowNote && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: eyebrowColor,
            }}
          >
            {tier.eyebrowNote}
          </div>
        )}
      </div>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: mutedColor,
          marginBottom: 28,
          fontStyle: "italic",
        }}
      >
        &ldquo;{tier.quote}&rdquo;
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 32px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 14,
              color: mutedColor,
              lineHeight: 1.5,
            }}
          >
            <Check size={16} style={{ color: checkColor, flexShrink: 0, marginTop: 2 }} />
            {f}
          </li>
        ))}
      </ul>

      {tier.ctaTo.startsWith("mailto") ? (
        <a
          href={tier.ctaTo}
          className="btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
            width: "100%",
            background: ctaBg,
            color: ctaColor,
          }}
        >
          {tier.cta} <ArrowRight size={14} />
        </a>
      ) : (
        <Link
          to={tier.ctaTo}
          className="btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
            width: "100%",
            background: ctaBg,
            color: ctaColor,
          }}
        >
          {tier.cta} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div
      className="card-pp"
      style={{
        padding: "24px 28px",
      }}
    >
      <h4
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#1A1224",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <HelpCircle size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
        {q}
      </h4>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6E6579", margin: 0 }}>{a}</p>
    </div>
  );
}
