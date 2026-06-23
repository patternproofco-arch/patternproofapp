import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Scale, Users } from "lucide-react";

export function FinalCTA() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(80px, 12vw, 160px) 24px",
        textAlign: "center",
        background:
          "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(124,92,196,0.35), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(47,141,133,0.30), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(61,114,184,0.25), transparent 60%), linear-gradient(135deg, #0E1B36 0%, #1B2A4A 50%, #14171F 100%)",
        color: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 700, marginBottom: 20 }}>
          The proof is in the patterns
        </div>
        <h2
          style={{
            fontSize: "clamp(2.4rem, 6vw, 5rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            color: "#FFFFFF",
            lineHeight: 1.05,
            marginBottom: 24,
            maxWidth: 980,
            margin: "0 auto 24px",
          }}
        >
          One platform.{" "}
          <span
            style={{
              background: "linear-gradient(90deg,#9ED8D0,#C4B0E8,#B5C7F0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Three missions.
          </span>
        </h2>
        <p
          style={{
            fontSize: 20,
            color: "rgba(255,255,255,0.82)",
            marginBottom: 64,
            maxWidth: 620,
            margin: "0 auto 64px",
            fontWeight: 500,
          }}
        >
          The proof is in the patterns.
        </p>

        <div className="final-cta-grid">
          <MissionCard
            to="/login"
            icon={<Heart size={22} />}
            iconBg="linear-gradient(135deg,#9ED8D0,#C4B0E8)"
            label="Survivors"
            line="document abuse."
            cta="Enter Survivor Portal"
            ctaBg="linear-gradient(90deg,#2F8D85,#7C5CC4)"
            ctaColor="#FFFFFF"
          />
          <MissionCard
            to="/lawyer-signup"
            icon={<Scale size={22} />}
            iconBg="linear-gradient(135deg,#B5C7F0,#9CB3E8)"
            label="Attorneys"
            line="build stronger cases."
            cta="Enter Attorney Portal"
            ctaBg="#FFFFFF"
            ctaColor="#0E1B36"
          />
          <MissionCard
            to="/request-org-access"
            icon={<Users size={22} />}
            iconBg="linear-gradient(135deg,#A8CCE0,#3D72B8)"
            label="Organizations"
            line="expand impact."
            cta="Enter Organization Portal"
            ctaBg="transparent"
            ctaColor="#FFFFFF"
            ctaBorder="1px solid rgba(255,255,255,0.4)"
          />
        </div>

        <p style={{ marginTop: 56, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
          Not an emergency service. In immediate danger, call 911.
        </p>
        <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          <Link to="/privacy" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "underline" }}>
            Privacy Policy
          </Link>
          <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
          <span>© {new Date().getFullYear()} PatternProof</span>
        </p>
      </div>
    </section>
  );
}

function MissionCard({
  to, icon, iconBg, label, line, cta, ctaBg, ctaColor, ctaBorder,
}: {
  to: string; icon: React.ReactNode; iconBg: string;
  label: string; line: string; cta: string;
  ctaBg: string; ctaColor: string; ctaBorder?: string;
}) {
  return (
    <div
      style={{
        padding: 32,
        borderRadius: 24,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      className="card-lift"
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: iconBg, color: "#0E1B36",
          display: "grid", placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.015em" }}>
          {label} {line}
        </div>
      </div>
      <Link
        to={to}
        style={{
          marginTop: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "13px 22px",
          borderRadius: 999,
          background: ctaBg,
          color: ctaColor,
          border: ctaBorder ?? "1px solid transparent",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        {cta} <ArrowRight size={14} />
      </Link>
    </div>
  );
}