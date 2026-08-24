import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useState } from "react";

// Neumorphic ground + soft-shadow cards, matching the rest of the app. Each
// audience keeps its own accent color (survivor ink / attorney navy / org
// sage) and mono eyebrows; steps reuse the .pp-thread connecting-line motif
// from the homepage's "How it works" section.

const INK = "var(--pp-ink)";
const MUTED = "var(--pp-muted)";
const SUBTEXT = "var(--pp-muted)";
const NAVY = "var(--pp-accent-attorney)";
const SAGE = "var(--pp-accent-org)";

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

type Audience = "survivor" | "attorney" | "org";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — PatternProof" },
      {
        name: "description",
        content:
          "A calm walkthrough of what actually happens inside PatternProof — for survivors documenting their own record, attorneys receiving it, and DV organizations referring survivors in.",
      },
      { property: "og:title", content: "How PatternProof works" },
      {
        property: "og:description",
        content: "Three short walkthroughs — survivor, attorney, DV organization.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/how-it-works" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "How PatternProof works" },
      {
        name: "twitter:description",
        content: "Three short walkthroughs — survivor, attorney, DV organization.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/how-it-works" }],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  const [aud, setAud] = useState<Audience>("survivor");
  const accent = aud === "attorney" ? NAVY : aud === "org" ? SAGE : INK;

  return (
    <div
      style={{ background: "var(--pp-ground)", color: INK, minHeight: "100vh", fontFamily: SANS }}
    >
      <PublicQuickExit />
      <TopBar />

      <section
        style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(56px,9vw,96px) 24px 24px" }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 22,
          }}
        >
          How it works
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "clamp(2rem,4.6vw,3.2rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Here is what actually happens.
        </h1>
        <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.6, color: SUBTEXT, maxWidth: 620 }}>
          Three short walkthroughs — one at a time. Pick the one that fits.
        </p>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "8px 24px 12px" }}>
        <div
          role="tablist"
          aria-label="Audience"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: 8,
            borderRadius: "var(--pp-r-lg)",
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-in-sm)",
          }}
        >
          <Picker
            label="I'm a survivor"
            active={aud === "survivor"}
            accent={INK}
            onClick={() => setAud("survivor")}
          />
          <Picker
            label="I'm an attorney"
            active={aud === "attorney"}
            accent={NAVY}
            onClick={() => setAud("attorney")}
          />
          <Picker
            label="I'm with a DV organization"
            active={aud === "org"}
            accent={SAGE}
            onClick={() => setAud("org")}
          />
        </div>
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "24px 24px 32px" }}>
        {aud === "survivor" && <SurvivorFlow accent={accent} />}
        {aud === "attorney" && <AttorneyFlow accent={accent} />}
        {aud === "org" && <OrgFlow accent={accent} />}
      </section>

      <section style={{ maxWidth: 780, margin: "0 auto", padding: "16px 24px 88px" }}>
        <div
          style={{
            borderRadius: "var(--pp-r-lg)",
            background: "var(--pp-card)",
            boxShadow: "var(--pp-shadow-sm)",
            padding: 24,
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 14, color: SUBTEXT, maxWidth: 420, lineHeight: 1.6 }}>
            Ready to try it, or want to see the audience page?
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {aud === "survivor" && (
              <PrimaryLink to="/signin" accent={INK} label="Start documenting →" />
            )}
            {aud === "attorney" && (
              <>
                <PrimaryLink to="/lawyer-signup" accent={NAVY} label="Attorney sign-up →" />
                <GhostLink to="/for-attorneys" label="Attorney overview" />
              </>
            )}
            {aud === "org" && (
              <>
                <PrimaryLink to="/org-signup" accent={SAGE} label="Partner with us →" />
                <GhostLink to="/for-organizations" label="Organization overview" />
              </>
            )}
          </div>
        </div>
      </section>

      <Foot />
    </div>
  );
}

function Picker({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        background: active ? "var(--pp-card)" : "transparent",
        boxShadow: active ? "var(--pp-shadow-sm)" : "none",
        border: 0,
        borderRadius: "var(--pp-r-pill)",
        padding: "10px 16px",
        cursor: "pointer",
        color: active ? accent : MUTED,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );
}

function Step({
  n,
  title,
  body,
  accent,
}: {
  n: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="pp-thread-row">
      <div
        className="pp-thread-node"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-in-sm)",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 13,
          color: accent,
        }}
      >
        {n}
      </div>
      <div
        className="pp-thread-card"
        style={{
          borderRadius: "var(--pp-r-lg)",
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-up)",
          padding: 24,
        }}
      >
        <div
          style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, color: INK, lineHeight: 1.2 }}
        >
          {title}
        </div>
        <p style={{ marginTop: 8, fontSize: 15.5, color: SUBTEXT, lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

function SurvivorFlow({ accent }: { accent: string }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <Eyebrow text="Survivor · What happens" accent={accent} />
      <div className="pp-thread" style={{ marginTop: 16 }}>
        <Step
          n="01"
          accent={accent}
          title="Add something whenever you're ready."
          body="A screenshot, a voice note, a few lines about what happened. No forms to finish, no pressure to be complete. Private by default. Protected with per-user access controls and encrypted in transit. You control what you share."
        />
        <Step
          n="02"
          accent={accent}
          title="It becomes a timeline on its own."
          body="Entries organize themselves by date, place, and type — including approximate dates like 'around April.' You can keep adding out of order; the record stays chronological."
        />
        <Step
          n="03"
          accent={accent}
          title="Corroboration surfaces what repeats."
          body="When the same person, place, or pattern shows up across separate entries, PatternProof quietly connects them — so a shape appears without you having to see it yourself."
        />
        <Step
          n="04"
          accent={accent}
          title="Share a read-only link — only if and when you choose."
          body="If you decide to work with an attorney or advocate, you can share a scoped, revocable link to specific incidents or the whole record. Nothing leaves your account otherwise."
        />
      </div>
    </div>
  );
}

function AttorneyFlow({ accent }: { accent: string }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <Eyebrow text="Attorney · What happens" accent={accent} />
      <div
        className="pp-thread"
        style={
          {
            marginTop: 16,
            "--pp-thread-grad": "linear-gradient(180deg, #3F6DF0, #1B2A6B)",
          } as React.CSSProperties
        }
      >
        <Step
          n="01"
          accent={accent}
          title="Your client shares their record."
          body="You receive a scoped link — they choose what you see. No shoebox handoff, no reconstructing three years from screenshots."
        />
        <Step
          n="02"
          accent={accent}
          title="You open a source-linked chronology on day one."
          body="Every date, location, and quote is attached to the entry it came from. Nothing floats loose; nothing is inferred without a citation."
        />
        <Step
          n="03"
          accent={accent}
          title="Cross-reference flags inconsistencies."
          body="Where the same event appears with different times, places, or details, the cross-reference view marks them — so you know exactly what to verify against the other party's account before hearing."
        />
        <Step
          n="04"
          accent={accent}
          title="Export a de-branded professional-review packet."
          body="A neutral PDF with exhibit labels, timeline, and source references — no PatternProof branding on the filing. Ready to hand a paralegal or attach to a motion."
        />
      </div>
    </div>
  );
}

function OrgFlow({ accent }: { accent: string }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <Eyebrow text="DV org / advocate · What happens" accent={accent} />
      <div
        className="pp-thread"
        style={
          {
            marginTop: 16,
            "--pp-thread-grad": "linear-gradient(180deg, #C3DBBC, #8FAF84)",
          } as React.CSSProperties
        }
      >
        <Step
          n="01"
          accent={accent}
          title="Hand a survivor the free tool at intake."
          body="PatternProof is free for survivors. You share your org's referral link — no seats to buy, no accounts to provision on your side."
        />
        <Step
          n="02"
          accent={accent}
          title="The survivor documents at their own pace. You see nothing unless they share it."
          body="Their account is theirs. Your organization has no automatic visibility into what they write. If they choose to share with an advocate at your org, they grant a scoped, revocable link and can end it at any time."
        />
        <Step
          n="03"
          accent={accent}
          title="At referral to counsel, the survivor shares a structured record."
          body="Instead of arriving at an attorney's office with a bag of screenshots, they arrive with a dated, source-linked chronology they wrote themselves."
        />
      </div>
    </div>
  );
}

function Eyebrow({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: accent,
        padding: "18px 0 4px",
      }}
    >
      {text}
    </div>
  );
}

function PrimaryLink({ to, accent, label }: { to: string; accent: string; label: string }) {
  return (
    <Link
      to={to}
      search={to === "/signin" ? {} : undefined}
      style={{
        display: "inline-block",
        background: accent,
        color: "#F4F6FB",
        padding: "12px 22px",
        fontFamily: MONO,
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        textDecoration: "none",
        borderRadius: "var(--pp-r-pill)",
      }}
    >
      {label}
    </Link>
  );
}

function GhostLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: "inline-block",
        padding: "12px 18px",
        fontFamily: MONO,
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: INK,
        textDecoration: "underline",
        textUnderlineOffset: 4,
      }}
    >
      {label}
    </Link>
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
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.14em",
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          How it works
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
