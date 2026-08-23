import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";

/**
 * DV organization landing — neumorphic ground + soft-shadow cards, sage
 * accent only. Framed as a referral partnership, not a paid product.
 * Before/after shows what advocate intake looks like without and with
 * PatternProof.
 */

const INK = "var(--pp-ink)";
const SAGE = "var(--pp-accent-org)";
const MUTED = "var(--pp-muted)";

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/for-organizations")({
  head: () => ({
    meta: [
      { title: "PatternProof — For DV organizations" },
      {
        name: "description",
        content:
          "A free, private documentation tool you can hand every survivor at intake. No cost to your org, no data-sharing with PatternProof — just a cleaner referral to counsel.",
      },
      { property: "og:title", content: "PatternProof — Partner referrals for DV organizations" },
      {
        property: "og:description",
        content:
          "Free survivor tool your advocates can hand out at intake. Cleaner referrals, no cost, no data-sharing.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/for-organizations" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof for DV organizations" },
      {
        name: "twitter:description",
        content: "Free survivor tool your advocates can hand out at intake.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-organizations" }],
  }),
  component: ForOrganizations,
});

function ForOrganizations() {
  return (
    <div
      data-persona="org"
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
          For DV organizations
        </div>
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
          Smoother days.
          <br />
          <em>More people served.</em>
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
          Less time on paperwork no one but your funder sees. More time with the person in front of
          you.
        </p>
        <Link
          to="/request-org-access"
          style={{
            display: "inline-block",
            marginTop: 34,
            background: SAGE,
            color: "var(--pp-ink)",
            padding: "14px 26px",
            fontFamily: MONO,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            borderRadius: "var(--pp-r-pill)",
          }}
        >
          See how it fits your program →
        </Link>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 80px" }}>
        <SectionRule label="Before / after" />
        <div style={{ display: "grid", gap: 16 }}>
          <BeforeAfter
            label="Intake"
            before="The survivor repeats their story to multiple staff members. Notes end up inconsistent across the team."
            after="Their history is documented once. Staff can review it without asking them to repeat it."
          />
          <BeforeAfter
            label="Case files"
            before="Scattered across paper files, shared drives, and individual caseworkers' notebooks."
            after="One organized record per survivor, visible to the staff they have approved."
          />
          <BeforeAfter
            label="Serving more people"
            before="Capacity is capped by hours spent per file — not by how many people are asking for help."
            after="Same staff, more room for the people already reaching out."
          />
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 80px" }}>
        <SectionRule label="The number that hasn't moved" />
        <div
          style={{
            background: "var(--pp-card)",
            boxShadow: "var(--pp-shadow-sm)",
            borderRadius: "var(--pp-r-lg)",
            borderLeft: `3px solid ${SAGE}`,
            padding: "24px 26px",
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 22,
              lineHeight: 1.5,
              color: INK,
            }}
          >
            Nationally, domestic violence programs turned away over{" "}
            <strong style={{ fontWeight: 500 }}>
              13,000 requests for help in a single day in 2025
            </strong>{" "}
            — not for lack of need, but for lack of staff time and resources. Time reclaimed from
            paperwork isn't spare time. It already has somewhere to go.
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: MONO,
              fontSize: 11,
              color: MUTED,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Source: NNEDV, 20th Annual Domestic Violence Counts Report, 2025
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 96px" }}>
        <SectionRule label="What this doesn't do" />
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
          Documentation takes up a large share of an advocate's day. We haven't measured how much
          time PatternProof saves your team, and we won't quote a number we can't stand behind — any
          gain depends on your intake process.
        </p>
        <p
          style={{
            marginTop: 18,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1.55,
            color: INK,
          }}
        >
          Every record stays under the survivor's control. This doesn't replace your judgment, your
          relationship with them, or your team's expertise — it gives you more of your day back to
          use it.
        </p>

        <div style={{ marginTop: 32, display: "grid", gap: 10 }}>
          <Link
            to="/request-org-access"
            style={{
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: INK,
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Wondering if this fits your existing VOCA/FVPSA funding? →
          </Link>
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
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.14em",
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            DV organizations
          </div>
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
      <div style={{ display: "grid", gap: 12 }}>
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
        <div style={{ borderLeft: `3px solid ${SAGE}`, paddingLeft: 14 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: "0.14em",
              color: SAGE,
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
