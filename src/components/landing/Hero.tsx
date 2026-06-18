import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ParticleField } from "./ParticleField";

export function Hero() {
  return (
    <section
      style={{
        position: "relative",
        padding: "96px 24px 80px",
        textAlign: "center",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at top, rgba(196,176,232,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(158,216,208,0.18), transparent 60%), var(--background)",
      }}
    >
      <ParticleField height={280} mode="converge" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Logo variant="survivor" size={88} />
        </div>
        <h1
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: 20,
          }}
        >
          The proof is in the patterns.
        </h1>
        <p
          style={{
            fontSize: 19,
            lineHeight: 1.6,
            color: "var(--muted-foreground)",
            maxWidth: 720,
            margin: "0 auto 36px",
          }}
        >
          P4TTERN PR00F turns scattered incidents, evidence, and timelines into organized
          patterns survivors can document, attorneys can review, and advocates can
          understand faster.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
          <Link
            to="/login"
            className="btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", fontSize: 15 }}
          >
            Start documenting <ArrowRight size={16} />
          </Link>
          <Link to="/for-attorneys" className="btn-ghost" style={{ padding: "14px 24px", fontSize: 15 }}>
            For attorneys
          </Link>
          <Link to="/for-organizations" className="btn-ghost" style={{ padding: "14px 24px", fontSize: 15 }}>
            For DV organizations
          </Link>
        </div>
        <p style={{ marginTop: 32, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700 }}>
          Turn scattered evidence into structured patterns
        </p>
      </div>
    </section>
  );
}