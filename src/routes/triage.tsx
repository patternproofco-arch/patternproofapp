import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

const INK = "#14131F";
const PAPER = "#F7F5F0";
const MUTED = "#6B6A78";
const RULE = "rgba(20,19,31,0.14)";
const VIOLET = "#5B4CD6";

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const Route = createFileRoute("/triage")({
  head: () => ({
    meta: [
      { title: "Where you are today — PatternProof" },
      { name: "description", content: "A few gentle questions so we can point you to the right next step — legal help, an advocate, or just a quiet place to write things down." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Triage,
});

type Step =
  | "case"
  | "lawyer"
  | "share"
  | "resources-ask"
  | "location"
  | "resources"
  | "home";

function Triage() {
  const [step, setStep] = useState<Step>("case");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");

  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <header style={{ borderBottom: `1px solid ${RULE}` }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "18px 24px", display: "flex", justifyContent: "space-between" }}>
          <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.14em", color: INK, textDecoration: "none", textTransform: "uppercase" }}>
            ← PatternProof
          </Link>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase" }}>
            Where you are today
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(48px,8vw,88px) 24px 80px" }}>
        {step === "case" && (
          <Panel
            eyebrow="Question 1 of 2 or 3"
            title="Do you have an active court case right now?"
            sub="A protective order, custody case, divorce, or anything else with a court date."
          >
            <Choices
              options={[
                { label: "Yes", onClick: () => setStep("lawyer") },
                { label: "No", onClick: () => setStep("resources-ask") },
                { label: "I'm not sure", onClick: () => setStep("resources-ask") },
              ]}
            />
          </Panel>
        )}

        {step === "lawyer" && (
          <Panel
            eyebrow="Question 2"
            title="Do you already have a lawyer?"
            sub="Someone representing you — paid, court-appointed, or through legal aid."
          >
            <Choices
              options={[
                { label: "Yes", onClick: () => setStep("share") },
                { label: "No", onClick: () => setStep("resources-ask") },
              ]}
            />
            <BackLink onClick={() => setStep("case")} />
          </Panel>
        )}

        {step === "share" && (
          <Panel
            eyebrow="For your lawyer"
            title="Send your records to your attorney."
            sub="You can create a private account, document at your own pace, and share a structured chronology with your lawyer when you're ready. Nothing is shared until you choose to share it."
          >
            <PrimaryAction to="/login" label="Start documenting →" />
            <SecondaryLink to="/how-it-works" label="See how sharing works" />
            <BackLink onClick={() => setStep("lawyer")} />
          </Panel>
        )}

        {step === "resources-ask" && (
          <Panel
            eyebrow="Before you go"
            title="Would you like help finding free legal or advocate resources near you?"
            sub="No pressure. If you'd rather just have a quiet place to write things down, that's fine too."
          >
            <Choices
              options={[
                { label: "Yes, help me find resources", onClick: () => setStep("location") },
                { label: "No, take me somewhere quiet", onClick: () => setStep("home") },
              ]}
            />
            <BackLink onClick={() => setStep("case")} />
          </Panel>
        )}

        {step === "location" && (
          <Panel
            eyebrow="So we can point you to the right place"
            title="Where are you?"
            sub="State and county help us match you to local free legal aid and DV programs. You can leave county blank."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (state.trim()) setStep("resources");
              }}
              style={{ display: "grid", gap: 12, marginTop: 8 }}
            >
              <input
                required
                placeholder="State (e.g. NJ, TX, CA)"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="County (optional)"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                style={inputStyle}
              />
              <button type="submit" style={primaryBtnStyle}>Find resources →</button>
            </form>
            <BackLink onClick={() => setStep("resources-ask")} />
          </Panel>
        )}

        {step === "resources" && (
          <Panel
            eyebrow={`Resources · ${state.toUpperCase()}${county ? " · " + county : ""}`}
            title="Free help near you."
            sub="These are national services that can route you to local free legal aid and DV programs in your state and county."
          >
            <ResourceList />
            <div style={{ marginTop: 24 }}>
              <SecondaryLink to="/login" label="Or start documenting privately →" />
            </div>
            <BackLink onClick={() => setStep("location")} />
          </Panel>
        )}

        {step === "home" && (
          <Panel
            eyebrow="No pressure"
            title="A quiet place to write things down."
            sub="You don't have to decide anything today. Create a private account, add what you remember at your own pace, and come back to any of this when you're ready."
          >
            <PrimaryAction to="/login" label="Start documenting →" />
            <SecondaryLink to="/how-it-works" label="See how it works first" />
            <BackLink onClick={() => setStep("resources-ask")} />
          </Panel>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 15,
  padding: "12px 14px",
  border: `1px solid ${RULE}`,
  background: PAPER,
  color: INK,
  borderRadius: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  background: INK,
  color: PAPER,
  padding: "14px 20px",
  fontFamily: MONO,
  fontSize: 13,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  border: 0,
  borderRadius: 0,
  cursor: "pointer",
};

function Panel({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>
        {eyebrow}
      </div>
      <h1 style={{ fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(1.9rem,4.4vw,2.8rem)", lineHeight: 1.15, letterSpacing: "-0.015em", margin: 0, color: INK }}>
        {title}
      </h1>
      {sub && (
        <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, color: "#3A3849" }}>{sub}</p>
      )}
      <div style={{ marginTop: 28 }}>{children}</div>
    </div>
  );
}

function Choices({ options }: { options: { label: string; onClick: () => void }[] }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={o.onClick}
          style={{
            textAlign: "left",
            background: PAPER,
            color: INK,
            border: `1px solid ${RULE}`,
            borderLeft: `3px solid ${VIOLET}`,
            padding: "14px 18px",
            fontFamily: SANS,
            fontSize: 15,
            cursor: "pointer",
            borderRadius: 0,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PrimaryAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      search={to === "/login" ? ({} as never) : undefined}
      style={{
        display: "inline-block",
        background: INK,
        color: PAPER,
        padding: "14px 22px",
        fontFamily: MONO,
        fontSize: 13,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        textDecoration: "none",
        borderRadius: 0,
      }}
    >
      {label}
    </Link>
  );
}

function SecondaryLink({ to, label }: { to: string; label: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <Link
        to={to}
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
        {label}
      </Link>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 28,
        background: "transparent",
        border: 0,
        padding: 0,
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: MUTED,
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      ← Back
    </button>
  );
}

function ResourceList() {
  const items = [
    { name: "National Domestic Violence Hotline", detail: "1-800-799-7233 · text START to 88788 · thehotline.org", url: "https://www.thehotline.org" },
    { name: "WomensLaw.org — legal info by state", detail: "State-by-state protective-order and custody guides.", url: "https://www.womenslaw.org" },
    { name: "LawHelp.org — free legal aid finder", detail: "Search free legal aid by state and county.", url: "https://www.lawhelp.org" },
    { name: "VictimConnect Resource Center", detail: "1-855-484-2846 — trauma-informed referrals.", url: "https://victimconnect.org" },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((r) => (
        <a
          key={r.name}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            border: `1px solid ${RULE}`,
            borderLeft: `3px solid ${VIOLET}`,
            padding: "14px 18px",
            textDecoration: "none",
            color: INK,
            background: PAPER,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.3 }}>{r.name}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: MUTED, fontFamily: SANS }}>{r.detail}</div>
        </a>
      ))}
    </div>
  );
}