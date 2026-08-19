import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";

const INK = "#1A1224";
const PAPER = "#FAF8F4";
const MUTED = "#6B6A78";
const RULE = "rgba(26,18,36,0.14)";
const VIOLET = "#4132B4";
const CAUTION = "#8A5A2E";

const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'Space Grotesk', ui-monospace, monospace";

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
      <PublicQuickExit />
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
          link={{ label: "Find a free DV advocate in your state →", to: "/resources" }}
        />

        <Exchange
          question="What actually happens when I file? Walk me through the day."
          kind="general"
          answer={
            <>
              Generally: you go to the clerk's window (family, civil, or domestic-relations, depending
              on the county) and ask for the protective-order petition packet. It's free to file —
              you should not be charged for a DV petition. You fill in who the other person is, your
              relationship, and what happened, with dates. Write plainly and specifically: “On March 4
              he blocked the door and took my phone” carries more than “he is controlling.” The clerk
              takes the packet to a judge, often the same day. Many courts now have a self-help desk
              or a DV advocate stationed in the building who will sit with you while you fill it out —
              ask at the window. Expect the whole visit to take a few hours, so bring what you'd need
              for a long wait, and arrange childcare if you can.
            </>
          }
          link={{ label: "Find a free DV advocate in your state →", to: "/resources" }}
        />

        <Exchange
          question="What is the hearing like?"
          kind="general"
          answer={
            <>
              The full hearing is usually scheduled within a couple of weeks of a temporary order.
              Both people are told to appear. It is generally short — often under an hour — and it is
              not a criminal trial. You'll be sworn in and asked to describe what happened; the other
              person, or their lawyer, may ask you questions. You may also be able to ask them
              questions. Judges are looking for specifics: dates, what was said, what was done, what
              you did afterwards. Answer only what is asked, say “I don't remember” when you don't,
              and don't guess. If the other person has a lawyer and you don't, you can ask the court
              for time to find one — legal aid or a DV program may be able to appear with you.
              If you're afraid to be in the same room, tell the clerk or the advocate <em>before</em>
              the hearing: many courts allow separate waiting areas, remote appearance, or a screen.
            </>
          }
          link={{ label: "Talk to a free legal-aid attorney →", to: "/resources" }}
        />

        <Exchange
          question="What should I bring with me?"
          kind="general"
          answer={
            <>
              A practical list:
              <ul style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 6 }}>
                <li>Photo ID, and any existing court paperwork — custody orders, prior protective orders, police report numbers.</li>
                <li>Your written timeline: dates, times, places, what happened, who saw it.</li>
                <li>Printed copies of anything you want the judge to see — messages, photos, call logs, medical or repair records. Bring <strong>three</strong> sets: one for the judge, one for the other side, one for you. Phones are often not enough; some courts won't scroll through a device.</li>
                <li>Names and contact details for witnesses, and whether they can attend.</li>
                <li>The other person's address, workplace, and vehicle, if you know them — orders have to be served, and the court needs somewhere to send the server.</li>
                <li>A list of exactly what you're asking for: no contact, stay-away distance, who stays in the home, temporary custody or a parenting-time schedule, pets, firearm surrender.</li>
                <li>A support person. They usually can't speak for you, but they can sit with you.</li>
              </ul>
            </>
          }
          link={{ label: "Build a printable packet from your records →", to: "/how-it-works" }}
        />

        <Exchange
          question="What if the other person doesn't show up, or the order gets denied?"
          kind="general"
          answer={
            <>
              If they were properly served and don't appear, a judge can often still grant the order.
              If service hasn't happened yet, the hearing is usually continued and any temporary order
              extended — ask the clerk to confirm that in writing before you leave. If the petition is
              denied, that is not the end of the road: in most states you can re-file if something new
              happens, and denial of a civil order doesn't stop a criminal case or a custody filing.
              Ask the court for the written reason, and take it to an advocate or legal-aid attorney —
              a denial is often about missing specifics rather than disbelief.
            </>
          }
          link={{ label: "Find a free DV advocate in your state →", to: "/resources" }}
        />

        <Exchange
          question="How long will my case take, and what will it cost?"
          kind="cant-answer"
          answer={
            <>
              This varies too much for anyone online to answer honestly — it depends on your county's
              docket, whether the other person contests, whether custody is also in play, and how
              quickly service happens. What's generally true: filing a DV protective order should be
              free, DV programs and legal aid cost nothing, and you should be skeptical of anyone who
              quotes you a timeline without knowing your court.
            </>
          }
          link={{ label: "Talk to a free legal-aid attorney →", to: "/resources" }}
        />

        <Exchange
          question="Will the judge believe me?"
          kind="cant-answer"
          answer={
            <>
              We can't answer this — and honestly, nobody online can. Whether a judge finds you credible depends on the specific judge, the evidence in front of them, how the other side testifies, and dozens of details in your case. What we <em>can</em> say: records written close to the time of an event, with their sources attached, are generally easier to present and harder to dispute than a narrative reconstructed later — which is one reason documenting as things happen can help.
            </>
          }
          link={{ label: "Talk to a free legal-aid attorney →", to: "/resources" }}
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