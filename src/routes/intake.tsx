import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Start documenting — PatternProof" },
      {
        name: "description",
        content:
          "A private vault for one person. Advocates can print a QR to this page. PatternProof does not own the file.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Intake,
});

function Intake() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--pp-ground)", color: "var(--pp-ink)", fontFamily: "var(--font-sans)" }}>
      <PublicQuickExit />
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--pp-muted)" }}>
          Intake · you keep the file
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "2rem", marginTop: 16 }}>
          Document once. Share only if you choose.
        </h1>
        <p style={{ lineHeight: 1.6, color: "var(--pp-muted)" }}>
          This page is meant to sit on a printed QR at a desk. The organization that showed it to you cannot see what you write unless you later send them a link.
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          <Link to="/signup" style={btn()}>
            Create a private account
          </Link>
          <Link to="/capture" style={btn(true)}>
            Record 60 seconds first
          </Link>
          <Link to="/how-it-works" style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            See how it works first
          </Link>
        </div>
        <p style={{ marginTop: 32, fontSize: 13, color: "var(--pp-muted)" }}>
          In danger now: call 911. National DV Hotline 1-800-799-7233.
        </p>
      </main>
    </div>
  );
}

function btn(ghost = false): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "14px 20px",
    borderRadius: 999,
    textDecoration: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    background: ghost ? "transparent" : "var(--pp-ink)",
    color: ghost ? "var(--pp-ink)" : "var(--pp-ground)",
    border: "1px solid var(--pp-ink)",
    textAlign: "center",
  };
}
