import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * DV organization landing — redaction/exhibit vernacular, sage accent only.
 * Framed as a referral partnership, not a paid product. Before/after
 * shows what advocate intake looks like without and with PatternProof.
 */

const INK = "#14131F";
const PAPER = "#F7F5F0";
const SAGE = "#2E4A38";
const MUTED = "#6B6A78";
const RULE = "rgba(20,19,31,0.14)";

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/for-organizations")({
  head: () => ({
    meta: [
      { title: "For DV organizations — PatternProof" },
      { name: "description", content: "A free, private documentation tool you can hand every survivor at intake. No cost to your org, no data-sharing with PatternProof — just a cleaner referral to counsel." },
      { property: "og:title", content: "PatternProof — Partner referrals for DV organizations" },
      { property: "og:description", content: "Free survivor tool your advocates can hand out at intake. Cleaner referrals, no cost, no data-sharing." },
      { property: "og:url", content: "https://pattern-proof.tech/for-organizations" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof for DV organizations" },
      { name: "twitter:description", content: "Free survivor tool your advocates can hand out at intake." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-organizations" }],
  }),
  component: ForOrganizations,
});

function ForOrganizations() {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <TopBar />

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 40px" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginBottom: 24 }}>
          For DV organizations
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2.2rem,5.2vw,3.8rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
          Smoother days.
          <br />
          <em>More people served.</em>
        </h1>
        <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.6, color: "#3A3849", maxWidth: 640 }}>
          Less time on paperwork no one but your funder sees. More time with the person in front of you.
        </p>
        <Link
          to="/request-org-access"
          style={{
            display: "inline-block", marginTop: 34, background: SAGE, color: "#F1F6F2",
            padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
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
            before="She repeats her story to multiple staff members. Notes end up inconsistent across the team."
            after="Her history is documented once. Staff can review it without asking her to repeat it."
          />
          <BeforeAfter
            label="Case files"
            before="Scattered across paper files, shared drives, and individual caseworkers' notebooks."
            after="One organized record per survivor, visible to the whole team."
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
            border: `1px solid ${RULE}`,
            borderLeft: `3px solid ${SAGE}`,
            padding: "24px 26px",
            clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
          }}
        >
          <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22, lineHeight: 1.5, color: INK }}>
            Nationally, domestic violence programs turned away over{" "}
            <strong style={{ fontWeight: 500 }}>13,000 requests for help in a single day in 2025</strong> — not for lack of need, but for lack of staff time and resources. Time reclaimed from paperwork isn't spare time. It already has somewhere to go.
          </div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Source: NNEDV, 20th Annual Domestic Violence Counts Report, 2025
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 96px" }}>
        <SectionRule label="What this doesn't do" />
        <p style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: INK, margin: 0 }}>
          Caseworkers report spending 45–50% of their time on documentation alone (NASW, Ferguson time-use studies) — reclaiming even part of that is real capacity, though the actual gain depends on your intake process.
        </p>
        <p style={{ marginTop: 18, fontFamily: SERIF, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: INK }}>
          Every record stays under the survivor's control. This doesn't replace your judgment, your relationship with her, or your team's expertise — it gives you more of your day back to use it.
        </p>

        <div style={{ marginTop: 32 }}>
          <Link
            to="/request-org-access"
            style={{
              display: "inline-block", background: SAGE, color: "#F1F6F2",
              padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
              textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
            }}
          >
            See how it fits your program →
          </Link>
        </div>

        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <Link
            to="/request-org-access"
            style={{
              fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
              color: INK, textDecoration: "underline", textUnderlineOffset: 4,
            }}
          >
            Wondering if this fits your existing VOCA/FVPSA funding? →
          </Link>
          <Link
            to="/privacy"
            style={{
              fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
              color: INK, textDecoration: "underline", textUnderlineOffset: 4,
            }}
          >
            How this handles VAWA confidentiality requirements →
          </Link>
        </div>
      </section>

      <Foot />
    </div>
  );
}

function TopBar() {
  return (
    <header style={{ borderBottom: `1px solid ${RULE}` }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: INK, textDecoration: "none", textTransform: "uppercase" }}>
          ← PatternProof
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link to="/how-it-works" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: INK, textDecoration: "underline", textUnderlineOffset: 4, textTransform: "uppercase" }}>
            How it works
          </Link>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase" }}>DV organizations</div>
        </div>
      </div>
    </header>
  );
}

function Foot() {
  return (
    <footer style={{ borderTop: `1px solid ${RULE}`, padding: "24px", fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em", textAlign: "center" }}>
      PATTERNPROOF · <Link to="/privacy" style={{ color: INK }}>PRIVACY</Link> · <Link to="/safety" style={{ color: INK }}>SAFETY</Link> · <Link to="/terms" style={{ color: INK }}>TERMS</Link>
    </footer>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "32px 0 24px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase" }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div
      style={{
        border: `1px solid ${RULE}`,
        background: PAPER,
        padding: "20px 22px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: INK, marginBottom: 14 }}>
        {label}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ borderLeft: `3px solid rgba(20,19,31,0.25)`, paddingLeft: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>
            Before
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>{before}</div>
        </div>
        <div style={{ borderLeft: `3px solid ${SAGE}`, paddingLeft: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: SAGE, textTransform: "uppercase", marginBottom: 4 }}>
            After
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: INK }}>{after}</div>
        </div>
      </div>
    </div>
  );
}
