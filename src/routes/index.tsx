import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { MicroMark } from "@/components/brand/MicroMark";
import { Briefcase, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search.ref === "string" ? { ref: search.ref } : {},
  head: () => ({
    meta: [
      { title: "PatternProof — Turn scattered evidence into structured patterns" },
      { name: "description", content: "PatternProof turns scattered incidents, evidence, and timelines into organized patterns survivors can document, attorneys can review, and advocates can understand faster." },
      { property: "og:title", content: "PatternProof — The proof is in the patterns." },
      { property: "og:description", content: "Pattern infrastructure for DV, custody, and coercive control documentation." },
      { property: "og:url", content: "https://pattern-proof.tech/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof — The proof is in the patterns." },
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
        <MicroMark size={34} />
        <div className="label-eyebrow">Preparing your space…</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F7F5F0", color: "#14131F" }}
    >
      <section
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "clamp(56px,9vw,104px) 24px 24px",
        }}
      >
        <BrandLockup size={70} />

        <h1
          style={{
            marginTop: 34,
            fontFamily: "'Newsreader', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2.2rem, 5.2vw, 3.6rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "#14131F",
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
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
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
              to="/for-attorneys"
              style={{
                display: "inline-block",
                background: "#152038",
                color: "#F4F6FB",
                padding: "14px 26px",
                fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
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
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
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
          <svg
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 0,
            }}
            preserveAspectRatio="none"
            viewBox="0 0 1000 120"
          >
            {/* faint ripple rings where the thread passes behind each card */}
            {[250, 500, 750].map((cx) => (
              <g key={cx} fill="none" stroke="#14131F" pointerEvents="none">
                <circle cx={cx} cy={60} r={16} strokeOpacity={0.16} strokeWidth={1.4} />
                <circle cx={cx} cy={60} r={26} strokeOpacity={0.10} strokeWidth={1.4} />
                <circle cx={cx} cy={60} r={36} strokeOpacity={0.05} strokeWidth={1.4} />
              </g>
            ))}
            <path
              d="M0,60 Q62.5,53 125,60 T250,60 T375,60 T500,60 T625,60 T750,60 T875,60 T1000,60"
              fill="none"
              stroke="#14131F"
              strokeWidth={1.5}
              strokeOpacity={0.18}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <PathCard
            accent="#5B4CD6"
            gradient="linear-gradient(135deg, #5B4CD6, #7C6DE0)"
            icon={FileText}
            label="Survivor"
            eyebrow="Survivor"
            body="Write down what happened, at your own pace. Photos, messages, and dates stay together — private, encrypted, only yours."
            to="/login"
            cta="Start documenting →"
          />
          <PathCard
            accent="#152038"
            gradient="linear-gradient(135deg, #152038, #253652)"
            icon={Briefcase}
            label="Attorney"
            eyebrow="Attorney"
            body="Get a source-linked chronology on day one instead of a shoebox of screenshots. Hearing prep starts with strategy, not sorting."
            to="/for-attorneys"
            cta="See a sample case →"
          />
          <PathCard
            accent="#2E4A38"
            gradient="linear-gradient(135deg, #2E4A38, #43684B)"
            icon={Users}
            label="DV Organization"
            eyebrow="DV organization"
            body="A free tool your advocates can hand a survivor at intake. She documents once; your referral to counsel arrives clean."
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
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: 13,
          color: "#3A3849",
          lineHeight: 1.7,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <MicroMark size={26} />
        </div>
        Every entry keeps its source. Private by default. Encrypted in transit and at rest. You control what you share, and you can export your records at any time.
        <div style={{ marginTop: 18 }}>
          <Link to="/how-it-works" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>How it works</Link>
          <Link to="/privacy" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Privacy</Link>
          <Link to="/resources" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Resources</Link>
          <Link to="/safety" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Safety</Link>
          <Link to="/terms" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginRight: 16 }}>Terms</Link>
          <Link to="/support" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3 }}>Support</Link>
          <Link to="/waitlist" style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3, marginLeft: 16 }}>Get updates</Link>
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
  eyebrow,
  body,
  to,
  cta,
}: {
  accent: string;
  gradient: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  eyebrow: string;
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
        color: "#14131F",
        border: "1px solid rgba(20,19,31,0.14)",
        borderLeft: `3px solid ${accent}`,
        background: "#F7F5F0",
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
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            padding: "4px 10px",
            borderRadius: 9999,
            background: "rgba(247,245,240,0.86)",
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#14131F",
          }}
        >
          {label}
        </span>
        <span aria-hidden="true">
          <Icon color="#F7F5F0" size={32} strokeWidth={1.5} />
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
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {eyebrow}
          </div>
          <p
            style={{
              marginTop: 12,
              fontFamily: "'Newsreader', Georgia, serif",
              fontWeight: 300,
              fontSize: 18,
              lineHeight: 1.5,
              color: "#14131F",
            }}
          >
            {body}
          </p>
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 18,
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
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
