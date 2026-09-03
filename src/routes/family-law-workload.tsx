import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";

/**
 * Family Law Attorney Insights — a research page, not a landing page.
 * Ported from a standalone research build; the live "check Reddit right
 * now" counter that used to live here called a backend this app doesn't
 * have and was failing (upstream auth error), so it's gone rather than
 * faked. The source list below is the same static, dated review that
 * counter was never more than a freshness badge on top of.
 *
 * Editorial order matters here: research sections first, PatternProof
 * context after the research, fictional example last, one restrained CTA
 * at the very end. The "review the example" link near the top is internal
 * page navigation, not the page's call to action.
 */

const INK = "var(--pp-ink)";
const NAVY = "var(--pp-accent-attorney)";
const MUTED = "var(--pp-muted)";

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

const RESEARCH_DATE = "2 September 2026";

interface Pattern {
  id: string;
  title: string;
  tag: string;
  summary: string;
  signal: string;
  designPrompt: string;
  communities: string[];
}

const PATTERNS: Pattern[] = [
  {
    id: "01",
    title: "Communication becomes emotional triage",
    tag: "Boundary pressure",
    summary:
      "The pressure is rarely just message volume. It's turning anxiety, urgency, and family conflict into a documented next step without becoming the client's sole support system.",
    signal:
      "Client-facing communities repeatedly frame silence, timing, and fee explanations as trust signals — in practice, a continuing expectation-management workload for lawyers and staff.",
    designPrompt:
      "Clarify who replies, what counts as urgent, and what a useful status update contains.",
    communities: ["r/FamilyLaw", "r/Divorce", "r/LawFirm"],
  },
  {
    id: "02",
    title: "The affordability–visibility paradox",
    tag: "Billing friction",
    summary:
      "Clients need an answer at the moment they're most distressed, but nearly every small interaction can create billable time — worse when fees are hard to anticipate or explain.",
    signal:
      "Consumer discussions concentrate on retainers, hourly charges, and perceived billing for small tasks. This is a client-perception finding, not an audit of attorney billing practices.",
    designPrompt:
      "Make cost-to-date, matter stage, and lower-cost alternatives visible before trust erodes.",
    communities: ["r/FamilyLaw", "r/Divorce"],
  },
  {
    id: "03",
    title: "Family matters refuse a single jurisdiction",
    tag: "Matter complexity",
    summary:
      "Custody, protective orders, support, and relocation matters expose lawyers to a collision of rules, venues, timelines, and emotionally charged facts.",
    signal:
      "The sampled conversations frequently feature interstate or international custody questions, disputes involving protective orders, and compressed hearing windows.",
    designPrompt:
      "Surface jurisdiction, next deadline, and risk context together — rather than burying them in a document list.",
    communities: ["r/FamilyLaw", "r/Divorce"],
  },
  {
    id: "04",
    title: "The operational substrate is overloaded",
    tag: "Workflow drag",
    summary:
      "Discovery, documents, calendaring, intake, and client updates operate as one system. When that system is manual, the support layer absorbs the complexity first.",
    signal:
      "Adjacent-professional discussions point to large active matter loads, discovery-heavy work, fragmented technology, and support staff handling informal IT and workflow coordination.",
    designPrompt:
      "Treat the case file as a shared operating surface, not a folder only the attorney can decode.",
    communities: ["r/paralegal", "r/LawFirm"],
  },
  {
    id: "05",
    title: "Practice knowledge does not transfer itself",
    tag: "Capability gap",
    summary:
      "Newer practitioners face a steep learning curve while smaller firms depend on tacit local knowledge — how a clerk's office works, what a judge expects, how to move a difficult matter forward.",
    signal:
      "Attorney-facing discussion highlights mentorship gaps and the limits of generic automation when the work depends on local procedure and relationship knowledge.",
    designPrompt:
      "Capture repeatable playbooks while preserving room for local judgment and supervision.",
    communities: ["r/LawFirm", "r/paralegal"],
  },
];

interface SourceRow {
  community: string;
  role: string;
  note: string;
  sourceUrl?: string;
}

const SOURCES: SourceRow[] = [
  {
    community: "r/FamilyLaw",
    role: "Client context",
    note: "Interstate custody, jurisdiction, and high-conflict matter context.",
    sourceUrl:
      "https://www.reddit.com/r/FamilyLaw/comments/1lezf9e/interstate_custody_caseca_and_va_attorneys_in/",
  },
  {
    community: "r/LawFirm",
    role: "Attorney operations",
    note: "Family-law software and small-office workflow needs.",
    sourceUrl:
      "https://www.reddit.com/r/LawFirm/comments/1f2rqb8/what_do_you_use_for_family_law_practice_software/",
  },
  {
    community: "r/Paralegal",
    role: "Support operations",
    note: "Case capacity, discovery load, filings, and staff pressure.",
    sourceUrl:
      "https://www.reddit.com/r/paralegal/comments/1pq0wgv/family_law_paralegal_179_active_cases/",
  },
  {
    community: "r/Divorce",
    role: "Client context",
    note: "Retainer anxiety and how legal-cost information is interpreted.",
    sourceUrl: "https://www.reddit.com/r/Divorce/comments/1tq49qk/attorney_retainer_fee/",
  },
  {
    community: "r/Lawyertalk",
    role: "Attorney perspective",
    note: "Emotional intensity, urgency expectations, and email overload in family-law practice.",
    sourceUrl:
      "https://www.reddit.com/r/Lawyertalk/comments/18zeas6/is_family_law_truly_the_worst_practice_area/",
  },
  {
    community: "r/Lawyers",
    role: "Not sampled",
    note: "Private-forum verification limits public, automated review; omitted from theme counts.",
  },
];

export const Route = createFileRoute("/family-law-workload")({
  head: () => ({
    meta: [
      { title: "PatternProof — Family Law Attorney Insights" },
      {
        name: "description",
        content:
          "A research-led look at recurring operational pressures in U.S. family-law attorney discussions on Reddit — published by PatternProof, with a fictional before-and-after example of a source-linked chronology.",
      },
      { property: "og:title", content: "Family Law Attorney Insights — PatternProof" },
      {
        property: "og:description",
        content:
          "Recurring operational pressures in family-law practice, drawn from public attorney discussions — plus a fictional example of an organized, source-linked chronology.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/family-law-workload" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Family Law Attorney Insights — PatternProof" },
      {
        name: "twitter:description",
        content:
          "Recurring operational pressures in family-law practice, from public attorney discussions.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/family-law-workload" }],
  }),
  component: FamilyLawWorkload,
});

function FamilyLawWorkload() {
  return (
    <div
      data-persona="attorney"
      style={{ background: "var(--pp-ground)", color: INK, minHeight: "100vh", fontFamily: SANS }}
    >
      <PublicQuickExit />
      <TopBar />
      <Hero />
      <PatternIndexSection />
      <SystemPressureSection />
      <MethodLedgerSection />
      <SourceRegisterSection />
      <AboutPatternProofSection />
      <FictionalExampleSection />
      <ClosingCta />
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
          flexWrap: "wrap",
          gap: 12,
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
            to="/for-attorneys"
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
            For attorneys
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(48px,8vw,88px) 24px 32px" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 16,
        }}
      >
        Family law attorney insights · Research snapshot · {RESEARCH_DATE}
      </div>

      {/* Publisher identification — visible near the top, plain and factual.
          Fuller PatternProof context (the product pitch) is deliberately
          held until after the research, in AboutPatternProofSection. */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: MONO,
          fontSize: 12.5,
          letterSpacing: "0.04em",
          color: INK,
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-sm)",
          borderRadius: "var(--pp-r-pill)",
          padding: "8px 16px",
          marginBottom: 22,
        }}
      >
        Published by{" "}
        <Link to="/" style={{ color: NAVY, textDecoration: "underline", textUnderlineOffset: 3 }}>
          PatternProof
        </Link>
      </div>

      <h1
        style={{
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: "clamp(2rem,4.8vw,3.4rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        Where the work gets heavier than the docket.
      </h1>
      <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.6, color: MUTED, maxWidth: 660 }}>
        A research-led view of the operational pressures that recur in publicly accessible Reddit
        discussions around U.S. family-law practice, client experience, and firm support work.
      </p>

      <div
        style={{
          marginTop: 28,
          maxWidth: 660,
          borderLeft: `3px solid ${NAVY}`,
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-sm)",
          borderRadius: "var(--pp-r-lg)",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NAVY,
            marginBottom: 8,
          }}
        >
          What this research is — and isn't
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: INK }}>
          A small, informal read of public Reddit threads — not representative survey research, not
          legal advice, and not an evaluation of any lawyer or firm. Reddit users self-select,
          high-conflict stories attract attention, and legal rules vary by state. Full method and
          limits are below.
        </p>
      </div>

      <a
        href="#fictional-example"
        style={{
          display: "inline-block",
          marginTop: 24,
          fontFamily: MONO,
          fontSize: 12.5,
          letterSpacing: "0.06em",
          color: INK,
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        Jump to the 2-minute fictional case example ↓
      </a>
    </section>
  );
}

function SectionRule({ index, label }: { index: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "32px 0 24px" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.18em",
          color: MUTED,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {index} / {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--pp-shadow-dark)" }} />
    </div>
  );
}

function PatternIndexSection() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px" }}>
      <SectionRule index="01" label="Pattern index" />
      <p style={{ margin: 0, maxWidth: 660, fontSize: 15, lineHeight: 1.6, color: MUTED }}>
        Five recurring pressure patterns surfaced across the sampled discussions. Each links a plain
        description to the kind of public discussion that produced it — not a ranking, not a
        scorecard.
      </p>
      <ul
        style={{
          margin: "20px 0 0",
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 8,
          maxWidth: 660,
        }}
      >
        {PATTERNS.map((p) => (
          <li key={p.id}>
            <a
              href={`#pattern-${p.id}`}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                padding: "10px 0",
                borderBottom: "1px solid var(--pp-shadow-dark)",
                textDecoration: "none",
                color: INK,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>{p.id}</span>
              <span style={{ fontFamily: SERIF, fontSize: 16.5 }}>{p.title}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: NAVY,
                }}
              >
                {p.tag}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SystemPressureSection() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 0" }}>
      <SectionRule index="02" label="System pressure" />
      <div style={{ display: "grid", gap: 16 }}>
        {PATTERNS.map((p) => (
          <div
            key={p.id}
            id={`pattern-${p.id}`}
            style={{
              scrollMarginTop: 90,
              background: "var(--pp-card)",
              boxShadow: "var(--pp-shadow-sm)",
              borderRadius: "var(--pp-r-lg)",
              padding: "24px 26px",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>{p.id}</span>
              <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, margin: 0 }}>
                {p.title}
              </h3>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: NAVY,
                }}
              >
                {p.tag}
              </span>
            </div>
            <p
              style={{ marginTop: 12, marginBottom: 0, fontSize: 15, lineHeight: 1.6, color: INK }}
            >
              {p.summary}
            </p>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: MUTED,
              }}
            >
              <strong style={{ color: INK }}>Signal from the sample: </strong>
              {p.signal}
            </p>
            <p
              style={{
                marginTop: 14,
                marginBottom: 0,
                fontFamily: MONO,
                fontSize: 12,
                lineHeight: 1.6,
                color: NAVY,
              }}
            >
              Practice design prompt — {p.designPrompt}
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.communities.map((c) => (
                <span
                  key={c}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: "0.04em",
                    color: MUTED,
                    border: "1px solid var(--pp-shadow-dark)",
                    borderRadius: "var(--pp-r-pill)",
                    padding: "3px 10px",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MethodLedgerSection() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 0" }}>
      <SectionRule index="03" label="Method ledger" />
      <div style={{ display: "grid", gap: 16, maxWidth: 780 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: INK }}>
          This page combines a dated, human-curated qualitative synthesis with a static register of
          the public threads that informed it. It intentionally separates attorney-facing evidence
          from consumer and adjacent-professional context, and it does not run a live check against
          Reddit — see the Source register below for why.
        </p>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: INK }}>
          The research posture is deliberately simple: listen for repeat tensions, retain the
          context that produced them, and resist turning public anecdotes into universal claims.
        </p>
        <div
          style={{
            borderLeft: "3px solid rgba(26,18,36,0.25)",
            background: "var(--pp-card)",
            boxShadow: "var(--pp-shadow-sm)",
            borderRadius: "var(--pp-r-lg)",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 8,
            }}
          >
            Limits
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: INK }}>
            Reddit users self-select, high-conflict stories attract attention, and legal rules vary
            by state. Public Reddit discussions are directional qualitative evidence. No individual
            post, contributor, lawyer, or firm is evaluated or quoted as a factual authority. This
            is not representative survey research, legal advice, or an evaluation of any lawyer.
          </p>
        </div>
      </div>
    </section>
  );
}

function SourceRegisterSection() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 0" }}>
      <SectionRule index="04" label="Source register" />
      <p style={{ margin: 0, maxWidth: 660, fontSize: 15, lineHeight: 1.6, color: MUTED }}>
        Each link opens the public discussion used as contextual evidence. They are not endorsements
        of every contribution or moderation stance. This list was manually reviewed on{" "}
        {RESEARCH_DATE} and does not update automatically — there is no live counter here, on
        purpose.
      </p>
      <div
        style={{ marginTop: 20, overflowX: "auto", borderTop: "1px solid var(--pp-shadow-dark)" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              {["Community", "Role", "Note", "Source"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    padding: "10px 12px 10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.community}>
                <td
                  style={{
                    padding: "12px 12px 12px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontFamily: MONO,
                    fontSize: 13,
                  }}
                >
                  {s.community}
                </td>
                <td
                  style={{
                    padding: "12px 12px 12px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: MUTED,
                  }}
                >
                  {s.role}
                </td>
                <td
                  style={{
                    padding: "12px 12px 12px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: INK,
                  }}
                >
                  {s.note}
                </td>
                <td style={{ padding: "12px 0", borderBottom: "1px solid var(--pp-shadow-dark)" }}>
                  {s.sourceUrl ? (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open cited ${s.community} discussion on Reddit`}
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        color: NAVY,
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                      }}
                    >
                      View thread →
                    </a>
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AboutPatternProofSection() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 24px 0" }}>
      <SectionRule index="05" label="About PatternProof" />
      <div style={{ maxWidth: 660, display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: INK }}>
          PatternProof publishes this research because the pressures above are the same ones its own
          product is built around: intake that arrives scattered, dates that are known with
          different degrees of certainty, and a firm's first hours on a matter going to sorting
          instead of reading.
        </p>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: INK }}>
          PatternProof creates a structured, source-linked chronology, preserves uncertainty, and
          may reduce initial sorting work. PatternProof organizes information. It does not decide
          what the information proves.
        </p>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: MUTED }}>
          More on what that looks like in practice:{" "}
          <Link
            to="/for-attorneys"
            style={{ color: NAVY, textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            what attorneys receive
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function FictionalExampleSection() {
  return (
    <section
      id="fictional-example"
      style={{ scrollMarginTop: 70, maxWidth: 1040, margin: "0 auto", padding: "56px 24px 0" }}
    >
      <SectionRule index="06" label="Fictional case example" />
      <div
        style={{
          display: "inline-block",
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#8e3434",
          border: "1px solid #8e3434",
          borderRadius: "var(--pp-r-pill)",
          padding: "5px 12px",
          marginBottom: 18,
        }}
      >
        Entirely fictional · Educational only · Not legal advice
      </div>
      <p style={{ margin: "0 0 8px", maxWidth: 700, fontSize: 15, lineHeight: 1.65, color: MUTED }}>
        Every name, date, number, and record below was invented for demonstration. It is not a real
        matter, not a composite of real clients, and contains no client information. The left side
        is what intake looks like when it arrives; the right side is the same material after a
        client organizes it in PatternProof, before counsel opens the file. About a two-minute read.
      </p>
      <p
        style={{ margin: "0 0 28px", maxWidth: 700, fontFamily: MONO, fontSize: 12.5, color: INK }}
      >
        Client: "Dana Alvarez," fictional. Post-judgment custody dispute with parenting-time
        exchanges, Burlington County, NJ. Fourteen months of material — an old phone, a newer phone,
        a shoebox, and a Gmail account.
      </p>

      <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, margin: "0 0 12px" }}>
        Before — what arrives at the firm
      </h3>
      <p style={{ margin: "0 0 12px", maxWidth: 700, fontSize: 14.5, lineHeight: 1.6, color: INK }}>
        One email with 11 attachments, a second email the next day with 6 more, a text to the
        paralegal saying "I found more," and a manila envelope dropped at the front desk.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, marginBottom: 16 }}
        >
          <thead>
            <tr>
              {["Item", "Condition it arrives in"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    padding: "8px 12px 8px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              [
                "148 screenshots of texts",
                "Cropped, out of order, duplicated across both emails. Several show only the message bubble — no date, no sender.",
              ],
              [
                "3 photos of a damaged door frame",
                "No date visible. Filenames IMG_4471.jpg, IMG_4472.jpg, photo (3).jpg.",
              ],
              ["2 voice memos", "11 minutes and 4 minutes. Nobody has listened to them yet."],
              [
                "Handwritten log, 9 pages",
                'Dates in the margins, some entries labeled "maybe the 12th?"',
              ],
              [
                "4 school pickup emails",
                "Forwarded, so original send dates are buried in quoted text.",
              ],
              [
                "Printed call log",
                'One month only. The client says the rest "is on the old phone."',
              ],
            ].map(([item, cond]) => (
              <tr key={item}>
                <td
                  style={{
                    padding: "10px 12px 10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: INK,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </td>
                <td
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: MUTED,
                  }}
                >
                  {cond}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "0 0 8px", maxWidth: 700, fontSize: 14, lineHeight: 1.6, color: INK }}>
        <strong>Where it goes wrong:</strong> the paralegal's chronology says "March 12" for an
        entry the client only ever described as "maybe the 12th." Nobody can now tell which entries
        were certain and which were guessed. The photos sit undated. Two screenshots are the same
        message, counted twice.
      </p>

      <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, margin: "32px 0 12px" }}>
        After — the same fourteen months, organized by the client
      </h3>
      <p style={{ margin: "0 0 16px", maxWidth: 700, fontSize: 14.5, lineHeight: 1.6, color: INK }}>
        Dana adds the material herself over three sittings — Threads for the message exports, Add
        Anything for the photos and voice memos, The Log for the handwritten entries — then uses
        Invites to share a selected subset with the firm. She controls what's shared and can revoke
        it. What counsel opens is a Chronology: ordered, source linked, with uncertainty preserved.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, marginBottom: 8 }}
        >
          <caption style={{ captionSide: "top", textAlign: "left", marginBottom: 8 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Chronology excerpt — 5 of 125 distinct entries
            </span>
          </caption>
          <thead>
            <tr>
              {["#", "Date", "Date state", "Entry", "Source"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    fontFamily: MONO,
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: MUTED,
                    padding: "8px 12px 8px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontSize: 13, color: INK }}>
            {[
              [
                "41",
                "2025-03-09",
                "Confirmed",
                "Exchange delayed 90 minutes",
                "Source linked — thread export",
              ],
              [
                "42",
                "2025-03-12",
                "Approximate",
                "Door frame damage at pickup; narrowed to Mar 10–14 by school email",
                "Source linked — 2 photos, 1 log entry",
              ],
              [
                "43",
                "2025-03-12",
                "Approximate",
                "Voice memo describing the same afternoon",
                "Source linked — audio, transcript unverified",
              ],
              [
                "44",
                "—",
                "Unknown",
                "Missed call series described in log; no call record available",
                "Source missing",
              ],
              [
                "45",
                "2025-03-18",
                "Confirmed",
                "School notifies both parents of late pickup",
                "Source linked — original email",
              ],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td
                    key={i}
                    style={{
                      padding: "10px 12px 10px 0",
                      borderBottom: "1px solid var(--pp-shadow-dark)",
                      fontWeight: i === 2 ? 600 : 400,
                      color:
                        i === 2
                          ? cell === "Unknown"
                            ? "#8e3434"
                            : cell === "Approximate"
                              ? NAVY
                              : INK
                          : undefined,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 20, maxWidth: 700 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: INK }}>
          <strong>Duplicates:</strong> 23 of the 148 screenshots marked Duplicate and consolidated —
          125 distinct records remain.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: INK }}>
          <strong>Flagged for review:</strong> 6 entries the firm may want to look at first,
          presented as entries worth a second look — not as findings.
        </p>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.6, color: INK }}>
            <strong>Loose Ends:</strong> 3 items that don't line up yet, for a human to judge:
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, color: MUTED }}>
            <li>Entry 42's photo timestamps conflict with the log's margin date by two days.</li>
            <li>
              The printed call log covers March only; entries 44 and 51 depend on records not
              produced.
            </li>
            <li>
              Two screenshots show the same conversation with different visible timestamps, likely
              device timezone. Unresolved.
            </li>
          </ol>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: INK }}>
          <strong>Trace:</strong> any entry above opens the original record in one click. Entry 42
          opens the two photos and the log page they came from.
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: INK }}>
          <strong>File Check:</strong> the export includes a file manifest so a recipient can
          confirm files weren't altered after export.
        </p>
      </div>

      <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, margin: "32px 0 12px" }}>
        What actually changed
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, marginBottom: 24 }}
        >
          <tbody>
            {[
              ["Records to review", "148 items, unsorted, duplicated", "125 distinct, ordered"],
              [
                "Date certainty",
                "Lost — guesses look like facts",
                "Preserved as Confirmed / Approximate / Unknown",
              ],
              [
                "Missing material",
                "Discovered piecemeal over weeks",
                "Named up front as Source missing",
              ],
              ["Path back to the original", "Manual search through email attachments", "One click"],
              ["First firm task", "Sorting", "Reading"],
              ["Who did the sorting", "Firm staff", "The client, before intake"],
            ].map(([label, before, after]) => (
              <tr key={label}>
                <td
                  style={{
                    padding: "10px 12px 10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {label}
                </td>
                <td
                  style={{
                    padding: "10px 12px 10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: MUTED,
                  }}
                >
                  {before}
                </td>
                <td
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--pp-shadow-dark)",
                    fontSize: 13.5,
                    color: INK,
                  }}
                >
                  {after}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          borderLeft: "3px solid rgba(26,18,36,0.25)",
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-sm)",
          borderRadius: "var(--pp-r-lg)",
          padding: "18px 20px",
          maxWidth: 700,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 8,
          }}
        >
          What this example does not claim
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: INK }}>
          <li>
            It does not claim the records prove anything — entry 42 is an approximate date with an
            unresolved conflict, shown that way on purpose.
          </li>
          <li>
            It does not claim a number of hours saved. Any figure a firm cites should be that firm's
            own measurement against its own baseline.
          </li>
          <li>
            It does not claim the output is court-ready, certified, or authenticated. The Review
            Packet is an organized handoff, not a legal conclusion.
          </li>
          <li>Voice memo transcripts are labeled unverified until a person reviews them.</li>
        </ul>
      </div>

      <p
        style={{ marginTop: 20, maxWidth: 700, fontSize: 12.5, fontStyle: "italic", color: MUTED }}
      >
        This section organizes fictional information for demonstration. It does not determine what
        any information proves, and it is not legal advice or a legal conclusion. Prepared using
        PatternProof.
      </p>
    </section>
  );
}

function ClosingCta() {
  return (
    <section style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 96px" }}>
      <div style={{ borderTop: "1px solid var(--pp-shadow-dark)", paddingTop: 28, maxWidth: 700 }}>
        <Link
          to="/for-attorneys"
          style={{
            fontFamily: MONO,
            fontSize: 12.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: NAVY,
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          See what attorneys receive on PatternProof →
        </Link>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: MUTED, maxWidth: 620 }}>
          No case files or client information, please — this page and the linked page are both
          readable without giving PatternProof anything.
        </p>
      </div>
    </section>
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
