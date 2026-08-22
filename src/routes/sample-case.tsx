import { createFileRoute, Link } from "@tanstack/react-router";
import { MARK_COLORWAYS } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";

/**
 * Fictional, read-only sample case shown to prospective attorneys.
 * Uses the redaction/exhibit visual system (same as /for-attorneys).
 */

const INK = "var(--pp-ink)";
const PAPER = "var(--pp-paper, #FAF8F4)";
const NAVY = MARK_COLORWAYS.attorney.solid!;
const MUTED = "var(--pp-muted)";
const RULE = "var(--pp-hairline, rgba(26,18,36,0.14))";

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/sample-case")({
  head: () => ({
    meta: [
      { title: "Sample case — PatternProof" },
      {
        name: "description",
        content:
          "A fictional, anonymized sample of what an attorney receives when a client shares her PatternProof record — structured chronology, source-linked exhibits, cross-reference.",
      },
      { property: "og:title", content: "Sample case — PatternProof" },
      {
        property: "og:description",
        content: "A fictional, anonymized sample of an attorney's view of a shared client record.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/sample-case" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Sample case — PatternProof" },
      {
        name: "twitter:description",
        content: "A fictional, anonymized sample of an attorney's view.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/sample-case" }],
  }),
  component: SampleCase,
});

type Certainty = "confirmed" | "approximate" | "unknown";

type Exhibit = {
  id: string;
  date: string;
  certainty: Certainty;
  title: string;
  detail: string;
};

const EXHIBITS: Exhibit[] = [
  {
    id: "011",
    date: "Feb 03, 2025 · 18:12",
    certainty: "confirmed",
    title: "Custody-exchange incident — children withheld 40 min past order",
    detail:
      "Contemporaneous journal entry with a survivor-stated location at the exchange point. One photo attached (timestamp intact).",
  },
  {
    id: "014",
    date: "Mar 12, 2025 · 19:40",
    certainty: "confirmed",
    title: "47-message text thread, escalating to threats",
    detail:
      "iMessage export, SHA-256 preserved. Language escalates from grievance → name-calling → explicit threat at message 41.",
  },
  {
    id: "015",
    date: "~Apr 2025 (anchor: before school let out)",
    certainty: "approximate",
    title: "Kids withheld at exchange — corroborates Exhibit 011",
    detail:
      "Survivor recalls the week before spring break. Same pattern as Feb 03. No photo; text to sister on Apr 09 references 'again today'.",
  },
  {
    id: "016",
    date: "Date unknown",
    certainty: "unknown",
    title: "Joint bank account locked — 1 statement PDF attached",
    detail:
      "Bank statement shows access-revocation flag. Survivor cannot pinpoint the day; discovered on a routine login attempt.",
  },
  {
    id: "018",
    date: "May 24, 2025 · 22:07",
    certainty: "confirmed",
    title: "Voicemail — 1:12 duration, aggressive tone",
    detail:
      "Audio file with AI-generated transcript (labeled unverified). Speaker 1 identified as opposing party by survivor.",
  },
  {
    id: "019",
    date: "~Jun 2025 (anchor: after Father's Day)",
    certainty: "approximate",
    title: "Location-sharing app re-enabled without consent",
    detail:
      "Screenshot of Life360 notification. GPS metadata quarantined server-side; not surfaced to attorney view.",
  },
  {
    id: "022",
    date: "Jul 08, 2025 · 08:30",
    certainty: "confirmed",
    title: "Missed pickup — school sign-out log attached",
    detail: "Third-party school record (PDF) plus survivor's contemporaneous journal entry.",
  },
];

type Cluster = {
  label: string;
  summary: string;
  items: string[];
};

const CLUSTERS: Cluster[] = [
  {
    label: "Timeline conflict — Feb 03 exchange",
    summary: "Two records reference the same custody exchange but differ on end-time by ~35 min.",
    items: [
      "Exhibit 011 (journal) — logged exchange completed 18:52.",
      "Exhibit 011a (text to sister, same evening) — 'he just left, 19:27'.",
    ],
  },
  {
    label: "Location mismatch — May 24 voicemail",
    summary:
      "Survivor's journal locates the call at home; carrier metadata places originating tower ~4 miles away.",
    items: [
      "Exhibit 018 (voicemail metadata) — originating cell tower: downtown.",
      "Exhibit 018 (journal note) — 'called while I was in the kitchen'.",
    ],
  },
];

function SampleCase() {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <PublicQuickExit />
      <TopBar />

      <section
        style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(48px,8vw,88px) 24px 24px" }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 20,
          }}
        >
          Sample case · Fictional
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(2rem,4.8vw,3.2rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Client: <em>Jane R.</em> <span style={{ color: MUTED }}>(fictional)</span>
        </h1>
        <p
          style={{
            marginTop: 16,
            fontSize: 15.5,
            lineHeight: 1.6,
            color: "#3A3849",
            maxWidth: 680,
          }}
        >
          This is a fictional sample case, shown to illustrate what an attorney receives — no real
          survivor's data.
        </p>
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
            gap: 10,
            maxWidth: 680,
          }}
        >
          <MetaCell label="Matter type" value="Custody / DV" />
          <MetaCell label="Jurisdiction" value="Sample County, ST" />
          <MetaCell label="Shared on" value="Aug 04, 2025" />
          <MetaCell label="Exhibits" value={String(EXHIBITS.length)} />
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 40px" }}>
        <SectionRule label="Exhibits" />
        <div style={{ display: "grid", gap: 12 }}>
          {EXHIBITS.map((e) => (
            <ExhibitRow key={e.id} ex={e} />
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 40px" }}>
        <SectionRule label="Cross-reference · Inconsistencies to verify" />
        <p
          style={{
            fontFamily: SERIF,
            fontSize: 16,
            lineHeight: 1.6,
            color: MUTED,
            margin: "0 0 18px",
            maxWidth: 640,
          }}
        >
          Detected deterministically from the record. Surfaced so you can reconcile them with the
          client before opposing counsel does.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {CLUSTERS.map((c) => (
            <ClusterRow key={c.label} c={c} />
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
        <SectionRule label="Export" />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled
            title="Disabled in this sample — available on real cases"
            style={{
              background: "var(--pp-ground)",
              color: MUTED,
              padding: "14px 26px",
              fontFamily: MONO,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "none",
              borderRadius: 0,
              cursor: "not-allowed",
            }}
          >
            Generate court packet
          </button>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>
            Disabled in this sample — available on real cases.
          </div>
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${RULE}`, background: "var(--pp-ground)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 300,
              fontSize: "clamp(1.4rem,2.6vw,1.8rem)",
              lineHeight: 1.3,
              color: INK,
              maxWidth: 620,
            }}
          >
            Ready to see this with your own client's record?
          </div>
          <Link
            to="/lawyer-signup"
            style={{
              display: "inline-block",
              marginTop: 22,
              background: NAVY,
              color: "#F4F6FB",
              padding: "14px 26px",
              fontFamily: MONO,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: 0,
            }}
          >
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
          to="/for-attorneys"
          style={{
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: "0.14em",
            color: INK,
            textDecoration: "none",
            textTransform: "uppercase",
          }}
        >
          ← For attorneys
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
          Sample · Read-only
        </div>
      </div>
    </header>
  );
}

function Foot() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${RULE}`,
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
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0 20px" }}>
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
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${RULE}`, padding: "10px 12px", background: PAPER }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.14em",
          color: MUTED,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 15, color: INK, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ExhibitRow({ ex }: { ex: Exhibit }) {
  const certColor =
    ex.certainty === "confirmed"
      ? NAVY
      : ex.certainty === "approximate"
        ? "rgba(26,18,36,0.45)"
        : "rgba(26,18,36,0.25)";
  const certLabel = ex.certainty.toUpperCase();
  return (
    <div
      style={{
        border: `1px solid ${RULE}`,
        background: PAPER,
        padding: "18px 20px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
        borderLeft: `3px solid ${certColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: INK,
          }}
        >
          Exhibit {ex.id} · {ex.date}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: certColor,
            textTransform: "uppercase",
          }}
        >
          {certLabel}
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.4, color: INK, marginTop: 8 }}>
        {ex.title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#3A3849", marginTop: 6 }}>
        {ex.detail}
      </div>
    </div>
  );
}

function ClusterRow({ c }: { c: Cluster }) {
  return (
    <div
      style={{
        border: `1px solid ${RULE}`,
        background: PAPER,
        padding: "18px 20px",
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
        borderLeft: `3px solid ${NAVY}`,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: NAVY,
        }}
      >
        {c.label}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.5, color: INK, marginTop: 8 }}>
        {c.summary}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
        {c.items.map((i) => (
          <li
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "16px 1fr",
              gap: 8,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: INK,
            }}
          >
            <span style={{ fontFamily: MONO, color: MUTED }}>·</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
