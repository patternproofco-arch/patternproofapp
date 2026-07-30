import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { MicroMark } from "@/components/brand/MicroMark";

export const Route = createFileRoute("/")({
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
          The file is not the story.
          <br />
          <em>
            <span className="highlight-thread">The pattern is.</span>
          </em>
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
          Choose the path that fits you.
        </p>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <PathCard
            accent="#5B4CD6"
            eyebrow="Survivor"
            body="Write down what happened, at your own pace. Photos, messages, and dates stay together — private, encrypted, only yours."
            to="/login"
            cta="Start documenting →"
          />
          <PathCard
            accent="#152038"
            eyebrow="Attorney"
            body="Get a source-linked chronology on day one instead of a shoebox of screenshots. Hearing prep starts with strategy, not sorting."
            to="/for-attorneys"
            cta="See a sample case →"
          />
          <PathCard
            accent="#2E4A38"
            eyebrow="DV organization"
            body="A free tool your advocates can hand a survivor at intake. She documents once; your referral to counsel arrives clean."
            to="/for-organizations"
            cta="See how it fits your program →"
          />
        </div>
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
        Work at your own pace — a few minutes today is enough. Only you can see what you write.
        <div style={{ marginTop: 18 }}>
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

function ProofRow({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 20, padding: "18px 0", borderBottom: "1px solid rgba(20,19,31,0.10)" }}>
      <div
        className="mono-meta mono-meta--muted"
        style={{ minWidth: 44, letterSpacing: "0.14em" }}
      >
        {n}
      </div>
      <div>
        <div
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontWeight: 400,
            fontSize: 20,
            color: "#14131F",
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <p
          style={{
            marginTop: 6,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: 15,
            color: "#3A3849",
            lineHeight: 1.6,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
