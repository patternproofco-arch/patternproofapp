import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect } from "react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandMark } from "@/components/BrandMark";
import { Briefcase, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" ? { ref: search.ref } : {},
  head: () => ({
    meta: [
      { title: "PatternProof — Turn scattered evidence into structured patterns" },
      { name: "description", content: "Turn scattered incidents, evidence, and timelines into organized patterns survivors can document, attorneys can review, and advocates understand faster." },
      { property: "og:title", content: "PatternProof — The truth is in the pattern." },
      { property: "og:description", content: "Pattern infrastructure for DV, custody, and coercive control documentation." },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof — The truth is in the pattern." },
      { name: "twitter:description", content: "Turn scattered evidence into structured patterns." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "PatternProof",
          description:
            "Pattern infrastructure for survivors, attorneys, and DV organizations. Turn scattered incidents, evidence, and timelines into organized patterns.",
          brand: { "@type": "Brand", name: "PatternProof" },
          url: "https://pattern-proof.tech/",
          offers: [
            { "@type": "Offer", name: "Survivor — Free", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/login", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "Attorney Solo", price: "297", priceCurrency: "USD", url: "https://pattern-proof.tech/for-attorneys", availability: "https://schema.org/InStock" },
            { "@type": "Offer", name: "DV Organization — Invite", price: "0", priceCurrency: "USD", url: "https://pattern-proof.tech/for-organizations", availability: "https://schema.org/LimitedAvailability" },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const attorneyMode = ref?.toLowerCase() === "attorney";
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <BrandMark size={34} />
        <div className="label-eyebrow">Preparing your space…</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FAF8F4", color: "#1A1224" }}
    >
      <PublicQuickExit />
      <section
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "clamp(56px,9vw,104px) 24px 24px",
        }}
      >
        <BrandLogo size={70} showTagline />

        <h1
          style={{
            marginTop: 34,
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2.2rem, 5.2vw, 3.6rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "#1A1224",
            marginBottom: 0,
          }}
        >
          {attorneyMode ? (
            <>
            A shoebox of screenshots isn't a chronology.
            <br />
            <em>
              <span className="highlight-thread">A source-linked timeline is.</span>
            </em>
            </>
          ) : (
            <>
              The file is not the story.
              <br />
              <em>
                <span className="highlight-thread">The pattern is.</span>
              </em>
            </>
          )}
        </h1>

        <p
          style={{
            marginTop: 20,
            fontSize: 17,
            lineHeight: 1.6,
            color: "#3A3849",
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            maxWidth: 620,
          }}
        >
          {attorneyMode
            ? "For attorneys: a structured, source-linked chronology on day one — not a shoebox of screenshots. Hearing prep starts with strategy, not sorting."
            : "Choose the path that fits you."}
        </p>

        {attorneyMode ? (
          <div style={{ marginTop: 34 }}>
            <Link
              to="/sample-case"
              style={{
                display: "inline-block",
                background: "#022063",
                color: "#F4F6FB",
                padding: "14px 26px",
                fontFamily: "'Space Grotesk', ui-monospace, monospace",
                fontSize: 13,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              See a sample case →
            </Link>
            <div style={{ marginTop: 18 }}>
              <Link
                to="/"
                search={{ ref: undefined }}
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: 13,
                  color: "#3A3849",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Not an attorney? See all options
              </Link>
            </div>
          </div>
        ) : (
        <div
          style={{
            position: "relative",
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <PathCard
            accent="#4132B4"
            gradient="linear-gradient(135deg, #4132B4, #A38BEB)"
            icon={FileText}
            label="Survivor"
            body="Write down what happened, at your own pace — photos, messages, and dates kept private and shared only when you choose."
            to="/login"
            cta="Start documenting →"
          />
          <PathCard
            accent="#022063"
            gradient="linear-gradient(135deg, #015FFD, #014ED1)"
            icon={Briefcase}
            label="Attorney"
            body="A source-linked chronology on day one — prep starts with strategy, not sorting."
            to="/sample-case"
            cta="See a sample case →"
          />
          <PathCard
            accent="#2F4E34"
            gradient="linear-gradient(135deg, #95AD85, #5F8B67)"
            icon={Users}
            label="DV Organization"
            body="A free intake tool for your advocates — she documents once, referrals arrive clean."
            to="/for-organizations"
            cta="See how it fits your program →"
          />
        </div>
        )}
      </section>

      <footer
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "44px 24px 96px",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 13,
          color: "#3A3849",
          lineHeight: 1.7,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <BrandMark size={26} />
        </div>
        Every entry keeps its source, and you control what you share.{" "}
        <Link to="/privacy" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>Learn more</Link>
        <div style={{ marginTop: 18 }}>
          <Link to="/privacy" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Privacy</Link>
          <Link to="/safety" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Safety</Link>
          <Link to="/support" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Support</Link>
          <details style={{ display: "inline-block" }}>
            <summary style={{ display: "inline", cursor: "pointer", color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>More</summary>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <Link to="/how-it-works" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>How it works</Link>
              <Link to="/resources" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>Resources</Link>
              <Link to="/terms" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>Terms</Link>
              <Link to="/waitlist" style={{ color: "#1A1224", textDecoration: "underline", textUnderlineOffset: 3 }}>Get updates</Link>
            </div>
          </details>
        </div>
      </footer>
    </div>
  );
}

function PathCard({
  accent,
  gradient,
  icon: Icon,
  label,
  body,
  to,
  cta,
}: {
  accent: string;
  gradient: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        textDecoration: "none",
        color: "#1A1224",
        border: "1px solid rgba(26,18,36,0.14)",
        borderLeft: `3px solid ${accent}`,
        background: "#FAF8F4",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: gradient,
        }}
      >
        <span aria-hidden="true">
          <Icon color="#FAF8F4" size={32} strokeWidth={1.5} />
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 22px 22px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {label}
          </div>
          <p
            style={{
              marginTop: 12,
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 300,
              fontSize: 18,
              lineHeight: 1.5,
              color: "#1A1224",
            }}
          >
            {body}
          </p>
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 18,
            fontFamily: "'Space Grotesk', ui-monospace, monospace",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          {cta}
        </span>
      </div>
    </Link>
  );
}
