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
          maxWidth: 780,
          margin: "0 auto",
          padding: "clamp(64px,10vw,120px) 24px 40px",
        }}
      >
        <BrandLockup size={78} />

        <div
          className="mono-meta mono-meta--muted"
          style={{ marginTop: 32, marginBottom: 28, textTransform: "uppercase" }}
        >
          PatternProof · Private documentation
        </div>

        <h1
          style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2.4rem, 5.6vw, 4.2rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#14131F",
            margin: 0,
          }}
        >
          Write it down while you remember.
          <br />
          <em style={{ color: "#14131F" }}>
            <span className="highlight-thread">Keep it in one place.</span>
          </em>
        </h1>

        <p
          style={{
            marginTop: 28,
            fontSize: 18,
            lineHeight: 1.6,
            color: "#3A3849",
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            maxWidth: 640,
          }}
        >
          A quiet, private space to record what happened — with the pacing you need,
          on infrastructure only you can see.
        </p>

        <div style={{ marginTop: 40 }}>
          <Link
            to="/choose-role"
            style={{
              display: "inline-block",
              background: "#14131F",
              color: "#F7F5F0",
              padding: "14px 26px",
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              borderRadius: 0,
              textDecoration: "none",
            }}
          >
            Start documenting →
          </Link>
          <Link
            to="/how-it-works"
            style={{
              display: "inline-block",
              marginLeft: 20,
              padding: "14px 4px",
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#14131F",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            See how it works
          </Link>
          <Link
            to="/resources"
            style={{
              display: "inline-block",
              marginLeft: 20,
              padding: "14px 4px",
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#14131F",
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Resources
          </Link>
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 13,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            color: "#3A3849",
          }}
        >
          Also here for a case?{" "}
          <Link
            to="/for-attorneys"
            style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            I'm an attorney
          </Link>
          {" · "}
          <Link
            to="/for-organizations"
            style={{ color: "#14131F", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            I'm with a DV organization
          </Link>
        </div>
      </section>

      <section
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "56px 24px 20px",
          borderTop: "1px solid rgba(20,19,31,0.14)",
        }}
      >
        <ProofRow
          n="01"
          title="Every entry is yours."
          body="Encrypted at rest. Nobody at PatternProof can read it. Export or delete at any time."
        />
        <ProofRow
          n="02"
          title="Every fact keeps its source."
          body="A date, a photo, a message — each attaches to the record it came from, so nothing floats loose."
        />
        <ProofRow
          n="03"
          title="Approximate is a first-class answer."
          body="You don't have to remember exact dates. Say ‘around April’ or ‘before school let out’ and move on."
        />
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
