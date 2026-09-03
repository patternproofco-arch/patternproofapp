import { createFileRoute, Link } from "@tanstack/react-router";
import { ThreadGroup } from "@/components/ThreadConnector";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useEffect, useState } from "react";
import { buildTiers } from "@/lib/pricing-tiers";
import { getCharterAvailability } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * Attorney landing — neumorphic ground + soft-shadow cards, navy accent
 * only. Day-to-day relief leads; case-volume math is second, framed as
 * proof, not the headline. Before/after comparison is muted-gray
 * "before" vs. single navy "after" — no more than two colors.
 */

const INK = "var(--pp-ink)";
const NAVY = "var(--pp-accent-attorney)";
const MUTED = "var(--pp-muted)";

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/for-attorneys")({
  head: () => ({
    meta: [
      { title: "PatternProof — For attorneys" },
      {
        name: "description",
        content:
          "Stop rebuilding what your client already lived. PatternProof hands you a structured, source-linked chronology on day one — so hearing prep goes to strategy, not sorting screenshots.",
      },
      { property: "og:title", content: "PatternProof for attorneys" },
      {
        property: "og:description",
        content:
          "A structured, source-linked chronology on day one — not a shoebox of screenshots.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/for-attorneys" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof for attorneys" },
      {
        name: "twitter:description",
        content: "A structured, source-linked chronology on day one.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-attorneys" }],
  }),
  component: ForAttorneys,
});

function ForAttorneys() {
  // Tier data comes from the shared pricing module so this page can never
  // drift from /pricing or from the live Charter cohort count.
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
  const attorneyTiers = buildTiers(remaining).filter((t) => t.key.startsWith("attorney_"));
  const solo = attorneyTiers.find((t) => t.key === "attorney_solo");
  const startsAt = `Plans start at ${solo?.price ?? "$297"} / month for a solo attorney seat`;
  return (
    <div
      data-persona="attorney"
      style={{ background: "var(--pp-ground)", color: INK, minHeight: "100vh", fontFamily: SANS }}
    >
      <PublicQuickExit />
      <TopBar />

      <section
        style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 40px" }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 24,
          }}
        >
          For attorneys
        </div>
        {/* Plain-language statement before the tagline headline, so a
            first-time visitor understands what this is within a few
            seconds. */}
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.5,
            color: "var(--pp-muted)",
            maxWidth: 560,
            marginBottom: 18,
          }}
        >
          PatternProof is a documentation platform your clients use to record domestic-violence and
          coercive-control incidents — you receive a structured, source-linked chronology instead of
          a folder of screenshots.
        </p>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "clamp(2.2rem,5.2vw,3.8rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Review an organized case timeline,
          <br />
          <em>without rebuilding it yourself.</em>
        </h1>
        <p
          style={{
            marginTop: 24,
            fontSize: 18,
            lineHeight: 1.6,
            color: "var(--pp-muted)",
            maxWidth: 640,
          }}
        >
          PatternProof turns client approved photos, messages, notes, and dates into a source-linked
          chronology you can review.
        </p>
        <div
          style={{
            marginTop: 32,
            maxWidth: 660,
            borderRadius: "var(--pp-r-lg)",
            boxShadow: "var(--pp-shadow-sm)",
            background: "var(--pp-card)",
            padding: "22px 24px",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 14,
            }}
          >
            What you get
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {[
              "Dated, source-linked chronology",
              "Uploaded records connected to each entry",
              "Exportable professional-review packet",
            ].map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  gap: 10,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--pp-muted)",
                }}
              >
                <span aria-hidden="true" style={{ color: NAVY, flexShrink: 0 }}>
                  —
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontFamily: MONO,
              fontSize: 11.5,
              lineHeight: 1.55,
              color: MUTED,
            }}
          >
            PatternProof organizes client-provided records. It does not provide legal advice or
            replace attorney judgment.
          </p>
        </div>
        <Link
          to="/demo"
          style={{
            display: "inline-block",
            marginTop: 34,
            background: NAVY,
            color: "#F4F6FB",
            padding: "14px 26px",
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "var(--pp-r-pill)",
          }}
        >
          View the Attorney Demo →
        </Link>
        <div
          style={{
            marginTop: 12,
            fontFamily: MONO,
            fontSize: 11,
            color: MUTED,
            letterSpacing: "0.06em",
          }}
        >
          {startsAt}
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 80px" }}>
        <SectionRule label="Before / after" />
        <ThreadGroup
          persona="attorney"
          orientation="vertical-behind"
          style={{ display: "grid", gap: 16 }}
        >
          <BeforeAfter
            label="Getting the records"
            before="Scattered across email, text exports, and files. Hours of sorting before you can start reading."
            after="Arrives already organized, timestamped, and sourced."
          />
          <BeforeAfter
            label="Building the timeline"
            before="Manually cross-referencing dates across a dozen documents."
            after="Built automatically from confirmed and approximate dates."
          />
          <BeforeAfter
            label="Starting the real work"
            before="Days spent organizing before the legal work even begins."
            after="Review starts the day the file arrives."
          />
        </ThreadGroup>

        <div style={{ marginTop: 40, maxWidth: 720 }}>
          <p
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1.55,
              color: INK,
              margin: 0,
            }}
          >
            Keep the original, add the context, and review the pattern without losing the source.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 96px" }}>
        <SectionRule label="Pricing" />
        <p style={{ margin: 0, color: MUTED, fontSize: 15 }}>
          {startsAt}. Firm plans are available.
        </p>
        <div style={{ marginTop: 16 }}>
          <Link
            to="/pricing"
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              letterSpacing: "0.14em",
              color: INK,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textTransform: "uppercase",
            }}
          >
            Compare attorney plans →
          </Link>
        </div>
        <div style={{ marginTop: 32 }}>
          <Link
            to="/subscribe"
            style={{
              display: "inline-block",
              background: NAVY,
              color: "#F4F6FB",
              padding: "14px 26px",
              fontFamily: MONO,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "var(--pp-r-pill)",
            }}
          >
            Create your attorney account →
          </Link>
          <div
            style={{
              marginTop: 12,
              fontFamily: MONO,
              fontSize: 11,
              color: MUTED,
              letterSpacing: "0.06em",
              maxWidth: 640,
              lineHeight: 1.6,
            }}
          >
            Review the demo before choosing a plan.
          </div>
        </div>
      </section>

      <Foot />
    </div>
  );
}

function TopBar() {
  return (
    <header style={{ boxShadow: "inset 0 -1px 0 var(--pp-shadow-dark)" }}>
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: "0.14em",
            color: INK,
            textDecoration: "none",
            textTransform: "uppercase",
          }}
        >
          ← PatternProof
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link
            to="/how-it-works"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: INK,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textTransform: "uppercase",
            }}
          >
            How it works
          </Link>
          <Link
            to="/subscribe"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: INK,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              textTransform: "uppercase",
            }}
          >
            Attorney portal
          </Link>
        </div>
      </div>
    </header>
  );
}

function Foot() {
  return (
    <footer
      style={{
        boxShadow: "inset 0 1px 0 var(--pp-shadow-dark)",
        padding: "24px",
        fontFamily: MONO,
        fontSize: 11,
        color: MUTED,
        letterSpacing: "0.06em",
        textAlign: "center",
      }}
    >
      PATTERNPROOF ·{" "}
      <Link to="/privacy" style={{ color: INK }}>
        PRIVACY
      </Link>{" "}
      ·{" "}
      <Link to="/safety" style={{ color: INK }}>
        SAFETY
      </Link>{" "}
      ·{" "}
      <Link to="/terms" style={{ color: INK }}>
        TERMS
      </Link>
    </footer>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "32px 0 24px" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.18em",
          color: MUTED,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--pp-shadow-dark)" }} />
    </div>
  );
}

function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div
      style={{
        background: "var(--pp-card)",
        boxShadow: "var(--pp-shadow-sm)",
        borderRadius: "var(--pp-r-lg)",
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: INK,
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div style={{ borderLeft: `3px solid rgba(26,18,36,0.25)`, paddingLeft: 14 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: "0.14em",
              color: MUTED,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Before
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>
            {before}
          </div>
        </div>
        <div style={{ borderLeft: `3px solid ${NAVY}`, paddingLeft: 14 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: "0.14em",
              color: NAVY,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            After
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: INK }}>
            {after}
          </div>
        </div>
      </div>
    </div>
  );
}
