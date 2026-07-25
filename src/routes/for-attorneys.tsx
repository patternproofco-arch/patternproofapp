import { createFileRoute, Link } from "@tanstack/react-router";

/**
 * Attorney landing — redaction/exhibit vernacular, navy accent only.
 * Day-to-day relief leads; case-volume math is second, framed as
 * proof, not the headline. Before/after comparison is muted-gray
 * "before" vs. single navy "after" — no more than two colors.
 */

const INK = "#14131F";
const PAPER = "#F7F5F0";
const NAVY = "#152038";
const MUTED = "#6B6A78";
const RULE = "rgba(20,19,31,0.14)";

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/for-attorneys")({
  head: () => ({
    meta: [
      { title: "For attorneys — PatternProof" },
      { name: "description", content: "Stop rebuilding what your client already lived. PatternProof hands you a structured, source-linked chronology on day one — so hearing prep goes to strategy, not sorting screenshots." },
      { property: "og:title", content: "PatternProof for attorneys" },
      { property: "og:description", content: "A structured, source-linked chronology on day one — not a shoebox of screenshots." },
      { property: "og:url", content: "https://pattern-proof.tech/for-attorneys" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "PatternProof for attorneys" },
      { name: "twitter:description", content: "A structured, source-linked chronology on day one." },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/for-attorneys" }],
  }),
  component: ForAttorneys,
});

function ForAttorneys() {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <TopBar />

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 40px" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginBottom: 24 }}>
          For attorneys
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2.2rem,5.2vw,3.8rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
          Smoother days,
          <br />
          <em>not just faster invoices.</em>
        </h1>
        <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.6, color: "#3A3849", maxWidth: 640 }}>
          Less time buried in scattered files. More of your day spent on the actual case.
        </p>
        <Link
          to="/lawyer-signup"
          style={{
            display: "inline-block", marginTop: 34, background: NAVY, color: "#F4F6FB",
            padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
          }}
        >
          See a sample case →
        </Link>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>
          $297 / mo · one seat · up to 10 active matters
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 80px" }}>
        <SectionRule label="Before / after" />
        <div style={{ display: "grid", gap: 16 }}>
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
        </div>

        <div style={{ marginTop: 40, display: "grid", gap: 14, maxWidth: 720 }}>
          <p style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: INK, margin: 0 }}>
            Every entry keeps its original source and metadata. Nothing here replaces your judgment.
          </p>
          <p style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 20, lineHeight: 1.55, color: INK, margin: 0 }}>
            Over time, less time spent sorting means more cases fit into the same week — without changing how you bill.
          </p>
        </div>

        <div style={{ marginTop: 32 }}>
          <Link
            to="/lawyer-signup"
            style={{
              display: "inline-block", background: NAVY, color: "#F4F6FB",
              padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
              textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
            }}
          >
            See a sample case →
          </Link>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 96px" }}>
        <SectionRule label="Pricing" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <PriceCard name="Solo" price="$297" per="/ month" bullets={["One attorney seat", "Up to 10 active matters", "Structured chronology + source-linked exhibits", "Cross-reference / inconsistency analysis", "De-branded court-packet PDF export"]} />
          <PriceCard name="Firm" price="$897" per="/ month" bullets={["3–15 attorney seats", "Unlimited active matters", "Shared caseload + collaborator roles", "Firm-wide document requests"]} highlight />
          <PriceCard name="Charter Firm" price="$597" per="/ month · locked 12 mo" bullets={["First 10 firms only", "Same as Firm tier", "Rate locked for 12 months", "Direct line to the PatternProof team"]} />
        </div>
        <div style={{ marginTop: 32 }}>
          <Link to="/lawyer-signup"
            style={{
              display: "inline-block", background: NAVY, color: "#F4F6FB",
              padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
              textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
            }}>
            Create your attorney account →
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
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase" }}>Attorney portal</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div style={{ borderLeft: `3px solid rgba(20,19,31,0.25)`, paddingLeft: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>
            Before
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>{before}</div>
        </div>
        <div style={{ borderLeft: `3px solid ${NAVY}`, paddingLeft: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: NAVY, textTransform: "uppercase", marginBottom: 4 }}>
            After
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.55, color: INK }}>{after}</div>
        </div>
      </div>
    </div>
  );
}

function PriceCard({ name, price, per, bullets, highlight }: { name: string; price: string; per: string; bullets: string[]; highlight?: boolean }) {
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${highlight ? NAVY : "rgba(20,19,31,0.18)"}`,
        borderLeft: `3px solid ${highlight ? NAVY : "rgba(20,19,31,0.35)"}`,
        padding: "24px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: highlight ? NAVY : MUTED, textTransform: "uppercase" }}>{name}</div>
      <div style={{ fontFamily: SERIF, fontSize: 40, marginTop: 6, color: INK }}>
        {price}<span style={{ fontFamily: MONO, fontSize: 12, color: MUTED, marginLeft: 6, letterSpacing: "0.06em" }}>{per}</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 14, display: "grid", gap: 8 }}>
        {bullets.map((b) => (
          <li key={b} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, fontSize: 13, lineHeight: 1.5, color: INK }}>
            <span style={{ fontFamily: MONO, color: MUTED }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
