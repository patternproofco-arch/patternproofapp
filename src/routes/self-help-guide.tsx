import { createFileRoute, Link } from "@tanstack/react-router";

const INK = "#14131F";
const PAPER = "#F7F5F0";
const MUTED = "#6B6A78";
const RULE = "rgba(20,19,31,0.14)";
const VIOLET = "#5B4CD6";
const CAUTION = "#8A5A2E";

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/self-help-guide")({
  head: () => ({
    meta: [
      { title: "Self-help guide — PatternProof" },
      { name: "description", content: "Plain-language answers to common questions about protective orders, custody, and evidence — and honest deflections when only a lawyer can answer." },
      { property: "og:title", content: "Self-help guide — PatternProof" },
      { property: "og:description", content: "General information about protective orders, custody, and evidence — with pointers to free legal help." },
    ],
  }),
  component: SelfHelpGuide,
});

function SelfHelpGuide() {
  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <header style={{ borderBottom: `1px solid ${RULE}` }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: INK, textDecoration: "none", textTransform: "uppercase" }}>
            ← PatternProof
          </Link>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase" }}>
            Self-help guide
          </div>
        </div>
      </header>

      {/* Sticky disclaimer */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: PAPER,
          borderBottom: `1px solid ${RULE}`,
          padding: "14px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 780,
            margin: "0 auto",
            border: `1px solid ${CAUTION}`,
            borderLeft: `3px solid ${CAUTION}`,
            padding: "12px 16px",
            background: "rgba(180,83,9,0.04)",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: CAUTION, marginBottom: 6 }}>
            Read this first
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: INK }}>
            This explains how things generally work. It isn't a lawyer, and it can't tell you what will happen in your specific case. For that, talk to a real advocate or attorney — free ones are listed on the previous page.
          </div>
        </div>
      </div>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "56px 24px 40px" }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(2rem,4.4vw,3rem)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0 }}>
          Questions people ask,
          <br />
          <em>answered honestly.</em>
        </h1>
        <p style={{ marginTop: 20, fontSize: 16, lineHeight: 1.6, color: "#3A3849" }}>
          Some questions have general answers. Others only a lawyer who knows your case can answer. We'll be clear about which is which.
        </p>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px 96px", display: "grid", gap: 32 }}>
        <Exchange
          question="How does the protective-order process actually work?"
          kind="general"
          answer={
            <>
              In most states, you file a petition at the courthouse (often the family or civil clerk's window). A judge reviews it the same day or next, and may issue a short-term <em>temporary</em> order right away — usually good for about 2 weeks. A full hearing is scheduled where both sides can testify. If the judge grants a <em>final</em> order, it typically lasts 1–5 years depending on your state. Advocates at your local DV program can walk into the courthouse with you at no cost.
            </>
          }
          link={{ label: "Find a free DV advocate in your state →", to: "/triage" }}
        />

        <Exchange
          question="Will the judge believe me?"
          kind="cant-answer"
          answer={
            <>
              We can't answer this — and honestly, nobody online can. Whether a judge finds you credible depends on the specific judge, the evidence in front of them, how the other side testifies, and dozens of details in your case. What we <em>can</em> say: judges tend to weigh contemporaneous, source-linked records more heavily than reconstructed narratives — which is one reason documenting as things happen matters.
            </>
          }
          link={{ label: "Talk to a free legal-aid attorney →", to: "/triage" }}
        />
      </section>

      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "24px", fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.06em", textAlign: "center" }}>
        PATTERNPROOF · <Link to="/privacy" style={{ color: INK }}>PRIVACY</Link> · <Link to="/safety" style={{ color: INK }}>SAFETY</Link> · <Link to="/terms" style={{ color: INK }}>TERMS</Link>
      </footer>
    </div>
  );
}

function Exchange({
  question,
  kind,
  answer,
  link,
}: {
  question: string;
  kind: "general" | "cant-answer";
  answer: React.ReactNode;
  link: { label: string; to: string };
}) {
  const isGeneral = kind === "general";
  const tagColor = isGeneral ? VIOLET : CAUTION;
  const tagLabel = isGeneral ? "General information" : "Can't answer this — here's who can";

  return (
    <article
      style={{
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid ${tagColor}`,
        padding: "24px",
        background: PAPER,
        clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
      }}
    >
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, lineHeight: 1.35, color: INK }}>
        “{question}”
      </div>

      <div
        style={{
          display: "inline-block",
          marginTop: 20,
          fontFamily: MONO,
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: tagColor,
          border: `1px solid ${tagColor}`,
          padding: "3px 8px",
        }}
      >
        {tagLabel}
      </div>

      <div style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.65, color: INK }}>
        {answer}
      </div>

      <div style={{ marginTop: 16 }}>
        <Link
          to={link.to}
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
          {link.label}
        </Link>
      </div>
    </article>
  );
}