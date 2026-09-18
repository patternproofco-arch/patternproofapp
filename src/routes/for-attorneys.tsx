import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { ProfessionalReadinessKitCapture } from "@/components/ProfessionalReadinessKitCapture";

const INK = "var(--pp-ink)";
const NAVY = "var(--pp-accent-attorney)";
const MUTED = "var(--pp-muted)";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/for-attorneys")({
  head: () => ({
    meta: [
      { title: "Family Law Evidence Intake Software for Attorneys | PatternProof" },
      {
        name: "description",
        content:
          "PatternProof helps family-law and domestic-violence attorneys review client-provided evidence in a dated, source-linked chronology instead of sorting screenshots, messages, and files by hand.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-attorneys" }],
  }),
  component: ForAttorneys,
});

const TRUST_ITEMS = [
  {
    title: "How evidence stays intact →",
    to: "/evidence-integrity",
    body: "Originals are preserved unchanged. A hash proves the file wasn’t altered; it does not prove that it is true, who created it, or whether it is admissible.",
  },
  {
    title: "What AI does and doesn’t do →",
    to: "/ai-transparency",
    body: "AI suggests groupings; it never asserts a legal fact. Suggestions can be confirmed, edited, rejected, or left for later. Rejected suggestions do not export.",
  },
  {
    title: "How client sharing works →",
    to: "/professional-access",
    body: "A survivor controls what you can see, for how long, and can revoke access. You can add notes; you cannot overwrite their record.",
  },
] as const;

function ForAttorneys() {
  return (
    <div
      data-persona="attorney"
      style={{ background: "var(--pp-ground)", color: INK, minHeight: "100vh", fontFamily: SANS }}
    >
      <PublicQuickExit />
      <TopBar />
      <section
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "clamp(56px,9vw,104px) 24px 40px",
        }}
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
        <div style={{ marginTop: 28 }}>
          <Link
            to="/demo"
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
            View the Attorney Demo →
          </Link>
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 48px" }}>
        <div
          style={{
            borderRadius: "var(--pp-r-lg)",
            background: "var(--pp-card)",
            boxShadow: "var(--pp-shadow-up)",
            padding: "clamp(22px,4vw,32px)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: "clamp(1.45rem,3vw,1.85rem)",
              lineHeight: 1.2,
            }}
          >
            Review one shared case without subscribing
          </h2>
          <p style={{ margin: "12px 0 0", fontSize: 15.5, lineHeight: 1.6, color: MUTED, maxWidth: 620 }}>
            When a survivor shares a case with you, follow the access steps in their link to review
            one chronology without a paid subscription. This is a single-case review, not a timed
            trial.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link
              to="/demo"
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.08em",
                color: INK,
                textTransform: "uppercase",
                textUnderlineOffset: 3,
              }}
            >
              See what one shared case includes →
            </Link>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 48px" }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, maxWidth: 640 }}>
          Solo workspace: $297/month. Firm Charter (up to 5 seats): $597/month for 12 months, then
          $897/month.
        </p>
        <div style={{ marginTop: 22 }}>
          <Link
            to="/lawyer-signup"
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
            Request verified attorney access →
          </Link>
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6, color: MUTED, maxWidth: 640 }}>
          We verify attorney identity before granting workspace access. Opening one survivor-shared
          case does not require a paid subscription. A paid seat unlocks notes, caseload view, and
          ZIP export.
        </p>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 56px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.to}
              style={{
                borderRadius: "var(--pp-r-lg)",
                background: "var(--pp-card)",
                boxShadow: "var(--pp-shadow-sm)",
                padding: 22,
              }}
            >
              <Link
                to={item.to}
                style={{
                  fontFamily: SERIF,
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: INK,
                  textDecoration: "none",
                }}
              >
                {item.title}
              </Link>
              <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, color: MUTED }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ProfessionalReadinessKitCapture embed />
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
        <a
          href="mailto:pattern@pattern-proof.tech?subject=Request%20a%2015-minute%20walkthrough"
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.14em",
            color: INK,
            textDecoration: "underline",
            textTransform: "uppercase",
          }}
        >
          Request a walkthrough
        </a>
      </div>
    </header>
  );
}
