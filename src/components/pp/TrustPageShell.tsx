import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { WavyThread } from "@/components/WavyThread";

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
    <div className="folio-shell pp-public-shell">
      <WavyThread />
      <p className="folio-kicker">Record</p>
      <h1 style={{ margin: "10px 0 12px", maxWidth: 640 }}>{title}</h1>
      {subtitle ? <p style={{ margin: "0 0 28px", maxWidth: 640 }}>{subtitle}</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative", zIndex: 1 }}>
        {children}
      </div>
      <p style={{ marginTop: 40, fontSize: 13 }}>
        This page describes controls that are implemented in PatternProof today. Related:{" "}
        <Link to="/privacy">Privacy</Link> · <Link to="/safety">Safety</Link> ·{" "}
        <Link to="/evidence-integrity">Evidence integrity</Link> ·{" "}
        <Link to="/ai-transparency">AI transparency</Link> ·{" "}
        <Link to="/professional-access">Professional access</Link>
      </p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="folio-plate">
      <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: "12px 0", padding: "12px 14px", borderLeft: "2px solid var(--stitch)", color: "var(--ink)", fontSize: 14 }}>
      {children}
    </div>
  );
}
