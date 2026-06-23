import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Scale, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ParticleField } from "./ParticleField";

export function Hero() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(80px, 12vw, 140px) 24px 96px",
        textAlign: "center",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(196,176,232,0.22), transparent 65%), radial-gradient(ellipse 70% 55% at 80% 30%, rgba(158,216,208,0.20), transparent 65%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(181,199,240,0.18), transparent 65%), var(--background)",
      }}
    >
      <ParticleField height={320} mode="converge" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Logo variant="survivor" size={88} />
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(20,23,31,0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#3D3832",
            marginBottom: 28,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "linear-gradient(90deg,#9ED8D0,#C4B0E8)" }} />
          Pattern infrastructure
        </div>

        <h1
          style={{
            fontSize: "clamp(2.6rem, 7vw, 6rem)",
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 1.02,
            marginBottom: 24,
            maxWidth: 1080,
            margin: "0 auto 24px",
          }}
        >
          The truth is rarely one incident.
          <br />
          <span
            style={{
              background: "linear-gradient(90deg,#2F8D85 0%,#7C5CC4 60%,#3D72B8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            The truth is the pattern.
          </span>
        </h1>
        <p
          style={{
            fontSize: "clamp(17px, 1.4vw, 21px)",
            lineHeight: 1.6,
            color: "#3D3832",
            fontWeight: 500,
            maxWidth: 680,
            margin: "0 auto 56px",
          }}
        >
          Turn incidents, screenshots, messages, photos, and documents into organized timelines,
          pattern analysis, and court-ready reports.
        </p>

        <div className="hero-audience-grid">
          <AudienceCard
            to="/login"
            tone="survivor"
            icon={<Heart size={20} />}
            eyebrow="Survivor Portal"
            title="Document. Organize. Reclaim your story."
            desc="Turn incidents, screenshots, photos, voice notes, and court documents into a clear, searchable timeline."
            cta="Enter Survivor Portal"
          />
          <AudienceCard
            to="/for-attorneys"
            tone="attorney"
            icon={<Scale size={20} />}
            eyebrow="Attorney Portal"
            title="Recover hours before the case begins."
            desc="Transform disorganized evidence into structured case intelligence and attorney-ready summaries."
            cta="Enter Attorney Portal"
          />
          <AudienceCard
            to="/for-organizations"
            tone="org"
            icon={<Users size={20} />}
            eyebrow="Organization Portal"
            title="Increase capacity without increasing staff."
            desc="Help more survivors while reducing intake and documentation workload."
            cta="Enter Organization Portal"
          />
        </div>
      </div>
    </section>
  );
}

function AudienceCard({
  to, tone, icon, eyebrow, title, desc, cta,
}: {
  to: string;
  tone: "survivor" | "attorney" | "org";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
}) {
  const styles = {
    survivor: {
      bg: "linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(248,243,255,0.88) 100%)",
      border: "1px solid rgba(196,176,232,0.45)",
      glow: "0 20px 60px -20px rgba(124,92,196,0.35), 0 0 0 1px rgba(196,176,232,0.30)",
      iconBg: "linear-gradient(135deg,#9ED8D0,#C4B0E8)",
      iconColor: "#14171F",
      ctaBg: "linear-gradient(90deg,#2F8D85,#7C5CC4)",
      ctaColor: "#FFFFFF",
      eyebrowColor: "#7C5CC4",
    },
    attorney: {
      bg: "linear-gradient(160deg, #0F1B3D 0%, #1B2A4A 100%)",
      border: "1px solid rgba(181,199,240,0.18)",
      glow: "0 20px 60px -20px rgba(15,27,61,0.55), 0 0 0 1px rgba(181,199,240,0.18)",
      iconBg: "rgba(181,199,240,0.18)",
      iconColor: "#E2E8F0",
      ctaBg: "#FFFFFF",
      ctaColor: "#0F1B3D",
      eyebrowColor: "#9CB3E8",
    },
    org: {
      bg: "linear-gradient(160deg, #F2F5FA 0%, #E4ECF5 100%)",
      border: "1px solid rgba(61,114,184,0.18)",
      glow: "0 20px 60px -20px rgba(61,114,184,0.30), 0 0 0 1px rgba(61,114,184,0.12)",
      iconBg: "rgba(61,114,184,0.14)",
      iconColor: "#1E3A5F",
      ctaBg: "#3D72B8",
      ctaColor: "#FFFFFF",
      eyebrowColor: "#1E3A5F",
    },
  }[tone];

  const titleColor = tone === "attorney" ? "#FFFFFF" : "#14171F";
  const descColor = tone === "attorney" ? "rgba(226,232,240,0.78)" : "#3D3832";

  return (
    <Link
      to={to}
      className="hero-audience-card"
      style={{
        background: styles.bg,
        border: styles.border,
        boxShadow: styles.glow,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: styles.iconBg,
          color: styles.iconColor,
          display: "grid",
          placeItems: "center",
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: styles.eyebrowColor,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <h3
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          color: titleColor,
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: descColor, marginBottom: 24, flex: 1 }}>
        {desc}
      </p>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 18px",
          borderRadius: 999,
          background: styles.ctaBg,
          color: styles.ctaColor,
          fontWeight: 700,
          fontSize: 13,
          alignSelf: "flex-start",
        }}
      >
        {cta} <ArrowRight size={14} />
      </span>
    </Link>
  );
}