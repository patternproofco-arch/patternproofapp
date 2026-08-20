import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinWaitlist } from "@/lib/waitlist.functions";

const INK = "#1A1224";
const PAPER = "#FAF8F4";
const MUTED = "#6B6A78";
const RULE = "rgba(26,18,36,0.14)";
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'Space Grotesk', ui-monospace, monospace";

type Interest = "survivor" | "attorney" | "organization" | "other";
const INTERESTS: { value: Interest; label: string }[] = [
  { value: "survivor", label: "Survivor" },
  { value: "attorney", label: "Attorney" },
  { value: "organization", label: "DV organization" },
  { value: "other", label: "Other" },
];

export const Route = createFileRoute("/waitlist")({
  validateSearch: (search: Record<string, unknown>): { as?: Interest } =>
    (["survivor", "attorney", "organization", "other"] as const).includes(search.as as Interest)
      ? { as: search.as as Interest }
      : {},
  head: () => ({
    meta: [
      { title: "Get updates from PatternProof" },
      {
        name: "description",
        content:
          "Leave your email and we'll follow up when there's something worth telling you — attorney access, organization partnerships, or new documentation tools.",
      },
      { property: "og:title", content: "Get updates from PatternProof" },
      {
        property: "og:description",
        content:
          "A short list for attorneys, DV organizations, and anyone who wants to hear when things ship.",
      },
      { property: "og:url", content: "https://pattern-proof.tech/waitlist" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Get updates from PatternProof" },
      {
        name: "twitter:description",
        content: "Leave your email — we'll follow up when there's something worth telling you.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/waitlist" }],
  }),
  component: Waitlist,
});

function Waitlist() {
  const { as } = useSearch({ from: "/waitlist" });
  const submit = useServerFn(joinWaitlist);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [interest, setInterest] = useState<Interest>(as ?? "other");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setState("saving");
    try {
      await submit({
        data: {
          email,
          name,
          interest,
          note,
          sourcePath:
            typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
        },
      });
      setState("done");
    } catch {
      setState("idle");
      setProblem("We couldn't save that just now. Try again in a moment.");
    }
  };

  return (
    <div style={{ background: PAPER, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <header style={{ borderBottom: `1px solid ${RULE}` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "18px 24px" }}>
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
        </div>
      </header>

      <section
        style={{ maxWidth: 620, margin: "0 auto", padding: "clamp(56px,9vw,104px) 24px 80px" }}
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
          Get updates
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(2rem,4.8vw,3.2rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Leave an email. <em>We'll follow up.</em>
        </h1>
        <p style={{ marginTop: 22, fontSize: 17, lineHeight: 1.6, color: "#3A3849" }}>
          No account, no commitment. We'll write when there's something worth telling you — nothing
          else.
        </p>

        <div style={{ marginTop: 26, display: "grid", gap: 12 }}>
          <Aside
            label="Attorneys"
            body={
              <>
                The attorney portal is open — you don't need this list.{" "}
                <Link
                  to="/lawyer-signup"
                  style={{ color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  Create your attorney account
                </Link>{" "}
                and you can start reviewing client documentation today.
              </>
            }
          />
          <Aside
            label="DV organizations"
            body="Not ready to sign up your organization yet? That's normal — most decisions need a supervisor. Leave your email and we'll follow up whenever it's useful."
          />
        </div>

        {state === "done" ? (
          <div
            style={{
              marginTop: 34,
              border: `1px solid ${RULE}`,
              padding: "24px 22px",
              background: "var(--pp-card)",
            }}
          >
            <div style={{ fontFamily: SERIF, fontSize: 22, marginBottom: 8 }}>
              Thank you — you're on the list.
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3A3849", margin: 0 }}>
              Nothing else is needed from you. We'll be in touch when there's news, and you can
              write back any time to be removed.
            </p>
            <div style={{ marginTop: 18 }}>
              <Link
                to="/"
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: INK,
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                Back to PatternProof →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: 34, display: "grid", gap: 16 }}>
            <Field label="Email">
              <input
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Name (optional)">
              <input
                type="text"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="I'm interested as a">
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value as Interest)}
                style={inputStyle}
              >
                {INTERESTS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Anything you'd like us to know (optional)">
              <textarea
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
              />
            </Field>

            {problem && (
              <div
                style={{
                  fontSize: 14,
                  color: "#3A3849",
                  borderLeft: `3px solid ${INK}`,
                  paddingLeft: 12,
                }}
              >
                {problem}
              </div>
            )}

            <button
              type="submit"
              disabled={state === "saving"}
              style={{
                justifySelf: "start",
                marginTop: 6,
                background: INK,
                color: PAPER,
                padding: "14px 26px",
                fontFamily: MONO,
                fontSize: 13,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: 0,
                cursor: state === "saving" ? "default" : "pointer",
                opacity: state === "saving" ? 0.6 : 1,
              }}
            >
              {state === "saving" ? "Saving…" : "Send it →"}
            </button>

            <p style={{ fontSize: 13, lineHeight: 1.6, color: MUTED, margin: 0 }}>
              We store your email so we can write to you, and nothing more. It isn't shared, and it
              isn't connected to any survivor records.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  border: `1px solid ${RULE}`,
  borderRadius: 2,
  background: "var(--pp-card)",
  fontSize: 15,
  color: INK,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function Aside({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${RULE}`, paddingLeft: 14 }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.55, color: "#3A3849" }}>{body}</div>
    </div>
  );
}
