import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AttorneyROICalculator } from "./AttorneyROICalculator";

const PAINS = [
  "No more rebuilding timelines from screenshots.",
  "Spot patterns of coercion, harassment, and custody interference faster.",
  "Stronger client packets before every hearing.",
];

export function AttorneySection() {
  return (
    <section
      id="attorneys"
      style={{
        padding: "96px 24px",
        background: "linear-gradient(180deg, #0F1B3D 0%, #142454 100%)",
        color: "#F5F7FF",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Logo variant="attorney" size={36} onDark />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,247,255,0.82)", fontWeight: 700 }}>
            For attorneys
          </span>
        </div>
        <h2 style={{ fontSize: "clamp(2rem, 4.2vw, 3.1rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", marginBottom: 20, lineHeight: 1.1 }}>
          Hours back before the case begins.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(245,247,255,0.85)", maxWidth: 600, marginBottom: 32 }}>
          Client incidents, evidence, and timelines — organized before they hit your desk.
        </p>

        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, marginBottom: 36, maxWidth: 760 }}>
          {PAINS.map((p) => (
            <li key={p} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 16, color: "rgba(245,247,255,0.9)" }}>
              <Check size={18} style={{ color: "#9ED8D0", marginTop: 3, flexShrink: 0 }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 56 }}>
          <a
            href="#att-calc"
            style={{
              padding: "14px 24px",
              borderRadius: 999,
              background: "#9ED8D0",
              color: "#0F1B3D",
              fontWeight: 700,
              fontSize: 15,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            Calculate time saved <ArrowRight size={16} />
          </a>
          <Link
            to="/lawyer-signup"
            style={{
              padding: "14px 24px",
              borderRadius: 999,
              border: "1px solid rgba(245,247,255,0.3)",
              color: "#F5F7FF",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Start attorney beta
          </Link>
        </div>

        <blockquote
          style={{
            borderLeft: "3px solid #9ED8D0",
            paddingLeft: 20,
            margin: "0 0 48px",
            fontSize: 18,
            lineHeight: 1.6,
            color: "rgba(245,247,255,0.9)",
            fontStyle: "italic",
            maxWidth: 600,
          }}
        >
          Every hour reconstructing the timeline is an hour off strategy.
        </blockquote>

        <div id="att-calc">
          <AttorneyROICalculator />
        </div>

        <PricingPsychology />
      </div>
    </section>
  );
}

function PricingPsychology() {
  return (
    <div
      style={{
        marginTop: 56,
        padding: 32,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 24,
      }}
    >
      <h3 style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
        $297/month. One billable hour.
      </h3>
      <p style={{ color: "rgba(245,247,255,0.85)", marginBottom: 24, fontSize: 16 }}>
        Save two billable hours a month — it pays for itself.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,247,255,0.82)", fontWeight: 700, marginBottom: 10 }}>
            Manual evidence organization
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, color: "rgba(245,247,255,0.9)", fontSize: 14 }}>
            <li>5 clients</li>
            <li>6 hours each</li>
            <li>30 admin/legal hours lost</li>
          </ul>
        </div>
        <div style={{ padding: 20, background: "rgba(158,216,208,0.10)", border: "1px solid rgba(158,216,208,0.30)", borderRadius: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9ED8D0", fontWeight: 700, marginBottom: 10 }}>
            With P4TTERN PR00F
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, color: "#FFFFFF", fontSize: 14 }}>
            <li>Organized timeline</li>
            <li>Evidence index</li>
            <li>Pattern summary</li>
            <li>Attorney-ready packet</li>
          </ul>
        </div>
      </div>
      <Link
        to="/lawyer-signup"
        style={{
          marginTop: 24,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 24px",
          borderRadius: 999,
          background: "#9ED8D0",
          color: "#0F1B3D",
          fontWeight: 700,
          fontSize: 15,
          textDecoration: "none",
        }}
      >
        Stop paying your team to untangle screenshots. <ArrowRight size={16} />
      </Link>
    </div>
  );
}