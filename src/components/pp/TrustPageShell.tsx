import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export function TrustPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="pp-public-shell">
      <PublicQuickExit />
      <div className="pp-public-rail" style={{ maxWidth: 720 }}>
        <Link
          to="/"
          className="pp-legal-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--pp-accent)",
            textDecoration: "none",
            fontWeight: 500,
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={14} /> Back to home
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 40,
            lineHeight: 1.15,
            margin: "8px 0 12px",
            fontWeight: 500,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{ fontSize: 17, color: "var(--pp-muted)", margin: "0 0 28px", lineHeight: 1.55 }}
          >
            {subtitle}
          </p>
        ) : null}
        <div
          style={{
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-sm)",
            borderRadius: "var(--pp-r-lg, 20px)",
            padding: "28px 30px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {children}
        </div>
        <hr
          style={{
            margin: "48px 0 20px",
            border: 0,
            borderTop: "1px solid var(--pp-hairline, rgba(0,0,0,0.08))",
          }}
        />
        <p style={{ fontSize: 12, color: "var(--pp-muted)" }}>
          This page describes controls that are implemented in PatternProof today. If a description
          does not match your experience, please tell us. Related:{" "}
          <Link to="/privacy" style={linkS}>
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/safety" style={linkS}>
            Safety
          </Link>{" "}
          ·{" "}
          <Link to="/evidence-integrity" style={linkS}>
            Evidence integrity
          </Link>{" "}
          ·{" "}
          <Link to="/ai-transparency" style={linkS}>
            AI transparency
          </Link>{" "}
          ·{" "}
          <Link to="/professional-access" style={linkS}>
            Professional access
          </Link>{" "}
          ·{" "}
          <Link to="/connect" style={linkS}>
            Connect an AI assistant
          </Link>
        </p>
      </div>
    </div>
  );
}

const linkS = { color: "var(--pp-accent)", textDecoration: "none", fontWeight: 500 } as const;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--pp-ground)",
        boxShadow: "var(--pp-shadow-xs)",
        borderRadius: "var(--pp-r-md, 16px)",
        padding: "20px 22px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          margin: "0 0 10px",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: "var(--pp-ink)" }}>{children}</div>
    </section>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--pp-ground)",
        boxShadow: "var(--pp-shadow-in-sm)",
        // Was "var(--pp-r-lg, 18px)" — --pp-r-lg is always defined at :root
        // (20px), so the fallback never actually applied, but it disagreed
        // with the 20px used everywhere else this token appears. Aligned so
        // nobody reads it as a deliberate smaller radius for callouts.
        borderRadius: "var(--pp-r-lg, 20px)",
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--pp-ink)",
        margin: "12px 0",
      }}
    >
      {children}
    </div>
  );
}
