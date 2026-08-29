import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { MARK_COLORWAYS } from "@/components/BrandMark";

const INK = "var(--pp-ink)";
const GROUND = "var(--pp-ground)";
const MUTED = "var(--pp-muted)";
const VIOLET = "var(--pp-accent)";
const NAVY = MARK_COLORWAYS.attorney.solid!;
const SAGE = MARK_COLORWAYS.advocate.solid!;

const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

export const Route = createFileRoute("/choose-role")({
  head: () => ({
    meta: [
      { title: "Choose your role — PatternProof" },
      {
        name: "description",
        content:
          "Are you a survivor, an attorney, or with a DV organization? Choose how you'd like to use PatternProof.",
      },
      { property: "og:title", content: "Choose your role — PatternProof" },
      {
        property: "og:description",
        content: "Survivor, attorney, or DV organization — pick where to start.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseRole,
});

function RoleLink({
  to,
  search,
  color,
  label,
}: {
  to: string;
  search?: Record<string, unknown>;
  color: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      style={{
        color,
        textDecoration: "underline",
        textDecorationThickness: 2,
        textUnderlineOffset: 6,
        fontStyle: "italic",
      }}
    >
      {label}
    </Link>
  );
}

function ChooseRole() {
  return (
    <div style={{ background: GROUND, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      <PublicQuickExit />
      <header style={{ boxShadow: "inset 0 -1px 0 var(--pp-shadow-dark)" }}>
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
        style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(72px,12vw,140px) 24px 60px" }}
      >
        <div
          className="mono-meta mono-meta--muted"
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
            marginBottom: 28,
          }}
        >
          Before we begin
        </div>

        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(2.2rem, 5.4vw, 3.8rem)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            margin: 0,
            color: INK,
          }}
        >
          I'm a <RoleLink to="/signin" search={{}} color={VIOLET} label="survivor" />, an{" "}
          <RoleLink to="/for-attorneys" color={NAVY} label="attorney" />, or with a{" "}
          <RoleLink to="/for-organizations" color={SAGE} label="DV organization" />.
        </h1>

        <p
          style={{
            marginTop: 32,
            fontSize: 16,
            lineHeight: 1.6,
            color: MUTED,
            fontFamily: SANS,
            maxWidth: 560,
          }}
        >
          You can change this later. Nothing is shared until you choose to share it.
        </p>

        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            boxShadow: "inset 0 1px 0 var(--pp-shadow-dark)",
          }}
        >
          <Link
            to="/how-it-works"
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
            Not sure yet? See how it works first →
          </Link>
        </div>
      </section>
    </div>
  );
}
