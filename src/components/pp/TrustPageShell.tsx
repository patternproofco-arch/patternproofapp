import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function TrustPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 60% at 15% 10%, rgba(196,176,232,0.18), transparent 60%), radial-gradient(ellipse 70% 50% at 90% 90%, rgba(158,216,208,0.18), transparent 60%), #FAFBFD",
        color: "#1F1A2E",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B5FA4", textDecoration: "none", fontWeight: 500, marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to home
        </Link>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 40, lineHeight: 1.15, margin: "8px 0 12px", fontWeight: 500 }}>{title}</h1>
        {subtitle ? <p style={{ fontSize: 17, color: "#4A4560", margin: "0 0 28px", lineHeight: 1.55 }}>{subtitle}</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>{children}</div>
        <hr style={{ margin: "48px 0 20px", border: 0, borderTop: "1px solid rgba(0,0,0,0.08)" }} />
        <p style={{ fontSize: 12, color: "#7A7590" }}>
          This page describes controls that are implemented in PatternProof today. If a description does not match your experience, please tell us. Related: {" "}
          <Link to="/privacy" style={linkS}>Privacy</Link> · {" "}
          <Link to="/safety" style={linkS}>Safety</Link> · {" "}
          <Link to="/evidence-integrity" style={linkS}>Evidence integrity</Link> · {" "}
          <Link to="/ai-transparency" style={linkS}>AI transparency</Link> · {" "}
          <Link to="/professional-access" style={linkS}>Professional access</Link>
        </p>
      </div>
    </div>
  );
}

const linkS = { color: "#6B5FA4", textDecoration: "none", fontWeight: 500 } as const;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, margin: "0 0 10px", fontWeight: 500 }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: "#2A2540" }}>{children}</div>
    </section>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "rgba(158,216,208,0.18)", border: "1px solid rgba(158,216,208,0.55)", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#2A2540", margin: "12px 0" }}>
      {children}
    </div>
  );
}