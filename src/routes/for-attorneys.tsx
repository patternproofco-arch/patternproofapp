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
          Attorneys · Family law &amp; coercive control
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2.2rem,5.2vw,3.8rem)", lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0 }}>
          Stop rebuilding what your client
          <br />
          <em>already lived.</em>
        </h1>
        <p style={{ marginTop: 24, fontSize: 18, lineHeight: 1.6, color: "#3A3849", maxWidth: 640 }}>
          You get a structured, source-linked chronology the day representation begins —
          not a shoebox of screenshots to sort at 11pm. Every date, every location, every
          exhibit already traceable to the record it came from.
        </p>
        <Link
          to="/lawyer-signup"
          style={{
            display: "inline-block", marginTop: 34, background: NAVY, color: "#F4F6FB",
            padding: "14px 26px", fontFamily: MONO, fontSize: 13, letterSpacing: "0.1em",
            textTransform: "uppercase", textDecoration: "none", borderRadius: 0,
          }}
        >
          Create your attorney account →
        </Link>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>
          $297 / mo · one seat · up to 10 active matters
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 80px" }}>
        <SectionRule label="How the file arrives" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          <ExhibitCard
            tag="BEFORE · WHAT INTAKE USUALLY LOOKS LIKE"
            tagTone="muted"
            body={
              <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, color: MUTED }}>
                &quot;Here&apos;s my phone.&quot; Thousands of photos in reverse-chronological order.
                A shared Google Doc titled &quot;notes&quot;. Screenshots named
                <span style={{ fontFamily: MONO, fontSize: 13 }}> IMG_4821.PNG</span>.
                A spiral notebook with entries out of order. Nothing tied to a date.
                Nothing tied to anything else.
              </div>
            }
          />
          <ExhibitCard
            tag="AFTER · WHAT PATTERNPROOF HANDS YOU"
            tagTone="accent"
            accent={NAVY}
            body={
              <div>
                <div style={{ display: "grid", gap: 10 }}>
                  <ExhibitRow n="014" date="MAR 12, 2025 · 19:40" summary="Text thread — 47 messages in 90 min, escalating from ‘call me’ to threats." linked="1 screenshot · 1 voice note" />
                  <ExhibitRow n="015" date="~ APR 2025" anchor="Before school let out" summary="Kids withheld at exchange. Location: Elm St. curb-side handoff." linked="Corroborating: EXHIBIT 011" />
                  <ExhibitRow n="016" date="Date unknown" summary="Bank account locked. Discovered morning of pediatrician appt." linked="1 statement PDF" />
                </div>
                <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.08em" }}>
                  Every field is source-linked. Approximate and unknown dates are first-class, not gaps.
                </div>
              </div>
            }
          />
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 80px" }}>
        <SectionRule label="Day-to-day" />
        <Relief n="01" title="Less time buried in scattered files." body="No mass-importing screenshots or asking a client to redo a timeline in Excel. It's already structured when you open the matter." />
        <Relief n="02" title="Dates you can actually cite." body="Confirmed dates stay confirmed. Approximate dates carry the anchor she gave you (‘before school let out’). Unknown stays unknown — never guessed." />
        <Relief n="03" title="Cross-references you can defend." body="Exhibits that share a date, a location, or a repeat tactic are linked deterministically. No AI hallucinations to walk back on the stand." />
        <Relief n="04" title="A packet a clerk will accept." body="Export a plain, numbered exhibit packet — no branding, no gradients — that reads like a document a court already recognizes." />
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 80px" }}>
        <SectionRule label="The math, once the file is clean" />
        <p style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22, lineHeight: 1.5, color: INK, margin: 0 }}>
          Intake and chronology work on a DV or coercive-control matter typically
          runs 8–14 hours before you can draft anything. A client who arrives
          already documented saves most of that — hours you can either bill on
          strategy or reclaim as capacity for another matter.
        </p>
        <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.08em" }}>
          Ranges from attorney conversations. Your file, your rates, your call.
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

function ExhibitCard({
  tag, tagTone, accent, body,
}: { tag: string; tagTone: "muted" | "accent"; accent?: string; body: React.ReactNode }) {
  const border = tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.20)";
  return (
    <div
      style={{
        position: "relative",
        background: PAPER,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.35)"}`,
        padding: "22px 24px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase",
          color: tagTone === "accent" && accent ? accent : MUTED,
          border: `1px solid ${tagTone === "accent" && accent ? accent : "rgba(20,19,31,0.25)"}`,
          padding: "3px 8px", marginBottom: 14,
        }}
      >
        {tag}
      </div>
      {body}
    </div>
  );
}

function ExhibitRow({ n, date, anchor, summary, linked }: { n: string; date: string; anchor?: string; summary: string; linked?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 14, padding: "10px 0", borderBottom: `1px dashed ${RULE}` }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", color: MUTED }}>
        EXHIBIT<br /><span style={{ color: INK, fontSize: 12 }}>{n}</span>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: INK, letterSpacing: "0.03em" }}>
          {date}{anchor && <span style={{ color: MUTED }}> · anchor: {anchor}</span>}
        </div>
        <div style={{ marginTop: 4, fontFamily: SERIF, fontSize: 15, lineHeight: 1.5, color: INK }}>{summary}</div>
        {linked && (
          <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 10.5, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {linked}
          </div>
        )}
      </div>
    </div>
  );
}

function Relief({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 20, padding: "20px 0", borderBottom: `1px solid ${RULE}` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", color: MUTED }}>{n}</div>
      <div>
        <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.25, color: INK }}>{title}</div>
        <p style={{ marginTop: 6, fontSize: 15, lineHeight: 1.6, color: "#3A3849" }}>{body}</p>
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
