import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo, type LogoVariant } from "@/components/Logo";
import { ParticleField } from "./ParticleField";

export function Hero() {
  const [active, setActive] = useState<"survivor" | "attorney" | "org" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids: Array<{ id: string; key: "survivor" | "attorney" | "org" }> = [
      { id: "survivors", key: "survivor" },
      { id: "attorneys", key: "attorney" },
      { id: "organizations", key: "org" },
    ];
    const els = ids
      .map((x) => ({ ...x, el: document.getElementById(x.id) }))
      .filter((x): x is { id: string; key: "survivor" | "attorney" | "org"; el: HTMLElement } => !!x.el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const match = els.find((x) => x.el === visible.target);
        if (match) setActive(match.key);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    els.forEach((x) => obs.observe(x.el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id: string, key: "survivor" | "attorney" | "org") => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(key);
    }
  };

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
          pattern analysis, and professional-review packets.
        </p>

        <div className="hero-audience-grid">
          <AudienceCard
            onClick={() => scrollTo("survivors", "survivor")}
            active={active === "survivor"}
            tone="survivor"
            eyebrow="Survivor Portal"
            title="Document. Organize. Reclaim your story."
            desc="Turn incidents, screenshots, photos, voice notes, and court documents into a clear, searchable timeline."
            cta="See how it works"
          />
          <AudienceCard
            onClick={() => scrollTo("attorneys", "attorney")}
            active={active === "attorney"}
            tone="attorney"
            eyebrow="Attorney Portal"
            title="Recover hours before the case begins."
            desc="Transform disorganized evidence into structured case intelligence and attorney-ready summaries."
            cta="See how it works"
          />
          <AudienceCard
            onClick={() => scrollTo("organizations", "org")}
            active={active === "org"}
            tone="org"
            eyebrow="Organization Portal"
            title="Increase capacity without increasing staff."
            desc="Help more survivors while reducing intake and documentation workload."
            cta="See how it works"
          />
        </div>
      </div>
    </section>
  );
}

function AudienceCard({
  onClick, active, tone, eyebrow, title, desc, cta,
}: {
  onClick: () => void;
  active: boolean;
  tone: "survivor" | "attorney" | "org";
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
      ctaBg: "linear-gradient(90deg,#2F8D85,#7C5CC4)",
      ctaColor: "#FFFFFF",
      eyebrowColor: "#7C5CC4",
    },
    attorney: {
      bg: "radial-gradient(ellipse 90% 70% at 80% 0%, rgba(80,130,230,0.30), transparent 60%), linear-gradient(160deg, #0F1B3D 0%, #1B2A4A 100%)",
      border: "1px solid rgba(181,199,240,0.18)",
      glow: "0 20px 60px -20px rgba(60,110,230,0.55), 0 0 80px -30px rgba(120,160,255,0.45), 0 0 0 1px rgba(181,199,240,0.18)",
      ctaBg: "#FFFFFF",
      ctaColor: "#0F1B3D",
      eyebrowColor: "#9CB3E8",
    },
    org: {
      bg: "radial-gradient(ellipse 90% 70% at 80% 0%, rgba(140,180,120,0.28), transparent 60%), linear-gradient(160deg, #EEF3E8 0%, #DCE7D2 100%)",
      border: "1px solid rgba(122,155,110,0.30)",
      glow: "0 20px 60px -20px rgba(90,122,79,0.35), 0 0 70px -30px rgba(140,180,120,0.45), 0 0 0 1px rgba(122,155,110,0.18)",
      ctaBg: "linear-gradient(90deg,#5A7A4F,#7A9B6E)",
      ctaColor: "#FFFFFF",
      eyebrowColor: "#3E5A33",
    },
  }[tone];

  const titleColor = tone === "attorney" ? "#FFFFFF" : tone === "org" ? "#1F2D1A" : "#14171F";
  const descColor = tone === "attorney" ? "rgba(226,232,240,0.78)" : tone === "org" ? "#36422F" : "#3D3832";

  const activeRing = {
    survivor: "0 0 0 2px #7C5CC4, 0 24px 70px -18px rgba(124,92,196,0.55)",
    attorney: "0 0 0 2px #9CB3E8, 0 24px 80px -18px rgba(80,130,230,0.65)",
    org: "0 0 0 2px #7A9B6E, 0 24px 70px -18px rgba(122,155,110,0.55)",
  }[tone];

  const logoVariant: LogoVariant = tone;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="hero-audience-card"
      style={{
        background: styles.bg,
        border: styles.border,
        boxShadow: active ? activeRing : styles.glow,
        transform: active ? "translateY(-2px)" : undefined,
        transition: "box-shadow 220ms ease, transform 220ms ease",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        position: "relative",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <Logo variant={logoVariant} size={56} onDark={tone === "attorney"} />
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
    </button>
  );
}