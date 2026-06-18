import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { PatternRevealSlider } from "./PatternRevealSlider";

export function SurvivorSection() {
  const [pos, setPos] = useState(0);
  return (
    <section
      id="survivors"
      style={{
        padding: "96px 24px",
        background: "linear-gradient(180deg, #FAFBFF 0%, #F4F1FB 100%)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Logo variant="survivor" size={36} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 700 }}>
            For survivors
          </span>
        </div>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20 }}>
          Scattered moments become a pattern.
        </h2>
        <p style={{ fontSize: 18, color: "var(--muted-foreground)", maxWidth: 720, marginBottom: 36 }}>
          {pos < 50
            ? "Without PatternProof, incidents can feel disconnected: a text here, a threat there, a missed exchange, a screenshot, a voice note, a memory."
            : "With PatternProof, those moments become a timeline, the timeline reveals patterns, and the patterns become easier to explain."}
        </p>

        <PatternRevealSlider value={pos} onChange={setPos} />

        <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to="/login"
            className="btn-primary"
            style={{ display: "inline-flex", alignItems: "center", padding: "14px 24px", fontSize: 15 }}
          >
            Start with one incident
          </Link>
        </div>
      </div>
    </section>
  );
}