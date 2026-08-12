import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight, HelpCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { BrandLogo } from "@/components/BrandLogo";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — PatternProof | Evidence Documentation for Survivors & Attorneys" },
      { name: "description", content: "PatternProof pricing: free forever for survivors. Solo attorney $297/mo. Firm plan $897/mo, with a Charter Firm rate of $597/mo locked for 12 months for the first 10 firms." },
      { property: "og:title", content: "Pricing — PatternProof" },
      { property: "og:description", content: "Free forever for survivors. Real multi-seat pricing for family-law firms. DV organizations partner with us at no cost." },
      { property: "og:url", content: "https://pattern-proof.tech/pricing" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/pricing" }],
  }),
  component: PricingPage,
});

type Tier = {
  key: string;
  name: string;
  price: string;
  priceStrike?: string;
  sub: string;
  eyebrowNote?: string;
  quote: string;
  features: string[];
  cta: string;
  ctaTo: string;
  featured?: boolean;
};

const BASE_TIERS: Tier[] = [
  {
    key: "survivor",
    name: "Survivor",
    price: "Free",
    sub: "forever",
    quote: "Built by a survivor, for survivors. Always free.",
    features: [
      "Unlimited incident logging",
      "Photo, document & audio evidence upload",
      "Structured chronological timeline",
      "Pattern detection",
      "Court packet export — printable case summary (HTML/PDF), free",
      "Attorney sharing — send a secure link to your attorney, free",
      "Encrypted in transit; per-user access controls",
    ],
    cta: "Start Documenting Free",
    ctaTo: "/login",
  },
  {
    key: "court_ready",
    name: "Court Ready",
    price: "Pay what you can",
    sub: "$1 – $500",
    quote: "For survivors actively preparing for a court date who need extra support without a fixed price barrier.",
    features: [
      "Everything in Survivor",
      "Priority court packet generation",
      "Expanded export formats (PDF, Markdown, printable packet)",
      "AI-assisted pattern summary for your records",
      "One-time unlock — no recurring subscription",
    ],
    cta: "Start Court Ready",
    ctaTo: "/login",
  },
  {
    key: "attorney_solo",
    name: "Solo Attorney",
    price: "$297",
    sub: "/month · Solo",
    quote: "For solo practitioners taking DV and custody cases one at a time.",
    features: [
      "One attorney seat",
      "Up to 10 active client matters",
      "Structured chronological timeline",
      "Source-linked supporting records",
      "Exportable case summary (ZIP) — imports into practice management systems",
      "Survivor vs. AI-suggested content clearly distinguished",
    ],
    cta: "Start with Solo",
    ctaTo: "/lawyer-signup",
  },
  // The Firm tier is inserted at runtime (see buildTiers below) so the
  // Charter rate + remaining-seat copy stays in sync with live cohort state.
  {
    key: "organization",
    name: "DV Organization",
    price: "Free",
    sub: "for every survivor you refer",
    quote: "You are a partner, not a customer. Your survivors never pay.",
    features: [
      "Free forever for every survivor your organization refers",
      "Referral link so we can attribute outcomes back to your advocacy",
      "Priority support for your intake team",
      "Direct line to the PatternProof team",
      "We onboard a limited number of organizations at a time",
    ],
    cta: "Partner with us",
    ctaTo: "/request-org-access",
  },
];

function buildTiers(remainingCharter: number | null): Tier[] {
  const charterFull = remainingCharter !== null && remainingCharter <= 0;
  const firm: Tier = charterFull
    ? {
        key: "attorney_firm",
        name: "Firm",
        price: "$897",
        sub: "/month · shared firm workspace",
        eyebrowNote: "Charter cohort is full — thank you.",
        quote: "Built for 3–15 attorney family-law firms.",
        features: [
          "Shared firm workspace — invite colleagues to a case (seat counts are not metered today)",
          "Everything in Solo Attorney",
          "No matter limit enforced today",
          "Multi-attorney collaboration and shared case notes",
          "Caseload and capacity view across the firm",
          "Conflict-of-interest check across your own PatternProof caseload",
          "Priority client onboarding + practice-management-ready exports",
        ],
        cta: "Start with Firm",
        ctaTo: "/lawyer-signup",
        featured: true,
      }
    : {
        key: "attorney_firm",
        name: "Firm",
        price: "$597",
        priceStrike: "$897",
        sub: "/month · locked for 12 months",
        eyebrowNote:
          remainingCharter === null
            ? "Charter program — limited to 10 firms"
            : `${remainingCharter} of 10 Charter spots remaining`,
        quote: "Built for 3–15 attorney family-law firms.",
        features: [
          "Shared firm workspace — invite colleagues to a case (seat counts are not metered today)",
          "Everything in Solo Attorney",
          "No matter limit enforced today",
          "Multi-attorney collaboration and shared case notes",
          "Caseload and capacity view across the firm",
          "Conflict-of-interest check across your own PatternProof caseload",
          "Charter program: personal setup, case import, and staff training",
          "$597/month rate locked for 12 months, then $897/month list",
        ],
        cta: "Apply for the Charter program",
        ctaTo: "/lawyer-signup",
        featured: true,
      };
  // Order: Survivor · Court Ready · Solo · Firm (featured, middle) · DV Organization
  return [BASE_TIERS[0], BASE_TIERS[1], BASE_TIERS[2], firm, BASE_TIERS[3]];
}

const FAQS = [
  {
    q: "Is it really free for survivors?",
    a: "Yes. Always. No credit card, no trial, no catch. Survivors never pay — and that includes the court packet export and sharing your case with an attorney. Professional Review is an optional add-on for AI-enhanced pattern analysis and premium formatting; nothing you need to walk into court is behind it.",
  },
  {
    q: "What's the Charter Firm program?",
    a: "We're onboarding the first 10 Charter Firms personally — full setup, case import, and staff training. Every Charter Firm gets the same terms: $597/month, locked for 12 months. After 12 months, the rate moves to the standard Firm price of $897/month and we'll notify you at least 60 days in advance.",
  },
  {
    q: "How is the Firm tier different from Solo?",
    a: "Firm gives you a shared firm workspace: colleagues can be added to a firm and cases can be shared between them, with shared case notes and a caseload view of the cases shared with you. A conflict-of-interest check runs across your own PatternProof caseload. Solo is a single attorney account. We do not currently meter seats or matter counts on either plan — those limits are commercial expectations, not technical caps.",
  },
  {
    q: "Why don't you sell to DV organizations?",
    a: "Organizations are our referral partners, not our customers. Every survivor a partner organization refers to PatternProof gets full access, free forever — no cost to the organization or the survivor. We work directly with a small number of organizations at a time so we can support your advocates properly.",
  },
  {
    q: "Does this work with my practice management system?",
    a: "There is no live sync. Attorney and Organization plans include a ZIP export of standard CSVs plus every evidence file, which you can import into the practice management system you already use.",
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
    try { env = getStripeEnvironment(); } catch { return; }
    getCharterAvailability({ data: { environment: env } })
      .then((r) => setRemaining(r.remaining))
      .catch(() => setRemaining(null));
  }, []);
  const tiers = buildTiers(remaining);
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
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

      <main className="app-surface" style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 120px" }}>
        {/* Trust line */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 2,
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
                borderRadius: 2,
                background: "#5E1730",
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
                background: "#7A1F3D",
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
            Choose the plan that fits your role. Every tier is built with the same privacy-first architecture.
          </p>
        </div>

        {/* Cards */}
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

  const cardBg = isAttorney
    ? "#4A2A6B"
    : isOrg
      ? "#FFFFFF"
      : "#FFFFFF";

  const border = isAttorney
    ? "1px solid rgba(181,199,240,0.18)"
    : isOrg
      ? "1px solid rgba(122,155,110,0.30)"
      : "1px solid rgba(196,176,232,0.45)";

  const glow = isAttorney
    ? "0 20px 60px -20px rgba(60,110,230,0.55), 0 0 80px -30px rgba(120,160,255,0.45), 0 0 0 1px rgba(181,199,240,0.18)"
    : isOrg
      ? "0 20px 60px -20px rgba(90,122,79,0.35), 0 0 70px -30px rgba(140,180,120,0.45), 0 0 0 1px rgba(122,155,110,0.18)"
      : "0 20px 60px -20px rgba(124,92,196,0.35), 0 0 0 1px rgba(196,176,232,0.30)";

  const textColor = isAttorney ? "#FFFFFF" : isOrg ? "#1F2D1A" : "#1A1224";
  const mutedColor = isAttorney ? "rgba(226,232,240,0.78)" : isOrg ? "#36422F" : "#6E6579";
  const checkColor = isAttorney ? "#9CB3E8" : isOrg ? "#5A7A4F" : "#7A1F3D";
  const eyebrowColor = isAttorney ? "#9CB3E8" : isOrg ? "#3E5A33" : "#7A1F3D";

  const ctaBg = isAttorney
    ? "#FFFFFF"
    : isOrg
      ? "#5E3785"
      : "#7A1F3D";
  const ctaColor = isAttorney ? "#0F1B3D" : "#FFFFFF";

  return (
    <div
      style={{
        background: cardBg,
        border,
        borderRadius: 2,
        padding: 36,
        boxShadow: "none",
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
            background: "#4A2A6B",
            color: "#FAF8F4",
            padding: "6px 16px",
            borderRadius: 2,
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
        <BrandMark size={44} onDark={isAttorney} />
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
            <Check
              size={16}
              style={{ color: checkColor, flexShrink: 0, marginTop: 2 }}
            />
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
      <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6E6579", margin: 0 }}>
        {a}
      </p>
    </div>
  );
}
