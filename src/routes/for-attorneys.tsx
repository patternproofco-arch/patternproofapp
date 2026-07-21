import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Star, ArrowRight } from "lucide-react";
import attorneyCss from "@/styles/attorney.css?url";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/for-attorneys")({
  head: () => ({
    links: [{ rel: "stylesheet", href: attorneyCss }],
    meta: [
      { title: "For attorneys — PatternProof" },
      { name: "description", content: "Your clients are already documented before they walk in the door. PatternProof for family-law attorneys handling DV and coercive control cases." },
      { property: "og:title", content: "PatternProof for Attorneys" },
      { property: "og:description", content: "Your clients are already documented before they walk in the door." },
    ],
  }),
  component: ForAttorneys,
});

const TIERS = [
  {
    key: "solo",
    name: "Solo",
    price: "$297",
    priceSub: "/month",
    bullets: [
      "One attorney seat",
      "Up to 10 active client matters",
      "Structured chronological timeline",
      "Source-linked supporting records",
      "Survivor vs. AI-suggested content clearly distinguished",
      "Exportable case summary (ZIP)",
      "Controlled client-sharing workflow",
    ],
  },
  {
    key: "pilot",
    name: "Founding Pilot",
    price: "$99",
    priceSub: "/month · 90 days",
    recommended: true,
    bullets: [
      "For the first 3 qualified family-law attorneys",
      "One attorney seat",
      "Up to 5 active matters",
      "Onboarding session included",
      "Weekly feedback expected",
      "Conversion discussion before pilot ends",
      "Application required",
    ],
  },
  {
    key: "enterprise",
    name: "Firm / Enterprise",
    price: "$1,497",
    priceSub: "/month",
    bullets: [
      "Multiple attorney seats",
      "Unlimited active matters",
      "Priority onboarding",
      "Direct line to the PatternProof team",
      "Contact us for scoping",
    ],
  },
];

function ForAttorneys() {
  return (
    <div className="att-root">
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "60px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Logo variant="attorney" size={120} />
          </div>
          <div className="att-eyebrow">Attorney Portal</div>
          <h1 style={{ fontSize: 56, lineHeight: 1.05, fontFamily: '"Instrument Serif", serif', marginTop: 12, marginBottom: 16, maxWidth: 880, marginLeft: "auto", marginRight: "auto" }}>
            See the pattern before the hearing.
          </h1>
          <p style={{ fontSize: 17, color: "var(--att-text-2)", maxWidth: 640, margin: "0 auto" }}>
            Your clients arrive already documented. PatternProof gives you a structured
            chronological timeline, source-linked supporting records, pattern flags, and
            an exportable case summary on day one of representation.
          </p>
          <Link to="/lawyer-signup" className="att-btn-primary" style={{ marginTop: 28, display: "inline-flex" }}>
            Apply for the Founding Pilot <ArrowRight size={14} />
          </Link>
          <p style={{ fontSize: 12, color: "var(--att-muted)", marginTop: 10 }}>
            First 3 qualified family-law attorneys · application required
          </p>
        </div>

        {/* Grace's story */}
        <div className="att-card" style={{ marginBottom: 56, background: "#FFFBEB", borderColor: "#FCD34D", maxWidth: 760, margin: "0 auto 56px" }}>
          <div className="att-eyebrow" style={{ color: "#92400E" }}>From Grace Burns, founder</div>
          <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}>
            "I documented everything. Nobody believed me anyway. I walked into that courtroom with folders of notes and screenshots and I still couldn't show the pattern. The judge couldn't see it. I built PatternProof because the evidence was always there — I just needed something that could show it."
          </p>
        </div>

        {/* Pricing */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {TIERS.map((t) => (
            <div
              key={t.key}
              className="att-card"
              style={{
                border: t.recommended ? "2px solid var(--att-green)" : "1px solid var(--att-border)",
                position: "relative",
                transform: t.recommended ? "translateY(-8px)" : undefined,
              }}
            >
              {t.recommended && (
                <span className="att-tag" style={{ position: "absolute", top: 14, right: 14, background: "var(--att-green)", color: "#fff", gap: 4, display: "inline-flex", alignItems: "center" }}>
                  <Star size={10} /> Recommended
                </span>
              )}
              <div className="att-eyebrow">{t.name}</div>
              <div style={{ fontSize: 40, fontFamily: '"Instrument Serif", serif', marginTop: 6 }}>
                {t.price}<span style={{ fontSize: 14, color: "var(--att-text-2)" }}>{t.priceSub}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8, fontSize: 13 }}>
                {t.bullets.map((b) => (
                  <li key={b} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Check size={14} style={{ color: "var(--att-green)", marginTop: 2, flexShrink: 0 }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Close */}
        <div style={{ textAlign: "center", padding: "40px 0", borderTop: "1px solid var(--att-border)" }}>
          <h2 style={{ fontSize: 28, fontFamily: '"Instrument Serif", serif' }}>
            $297/month — one attorney seat, up to 10 active matters.
          </h2>
          <p style={{ fontSize: 14, color: "var(--att-text-2)", marginTop: 8 }}>
            Or apply for the Founding Pilot: $99/month for 90 days, capped at 5 matters.
          </p>
          <Link to="/lawyer-signup" className="att-btn-primary" style={{ marginTop: 18, display: "inline-flex" }}>
            Create your attorney account <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}