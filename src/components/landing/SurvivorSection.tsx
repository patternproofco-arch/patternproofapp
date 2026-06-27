import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, MessageSquare, Image as ImageIcon, Mic, FileText, Calendar, Shield, CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PatternRevealSlider } from "./PatternRevealSlider";

const USE_CASES = [
  "Custody disputes",
  "Protective orders",
  "Divorce proceedings",
  "Co-parenting conflicts",
  "Harassment",
  "Stalking",
  "Threats",
  "Immigration support",
  "Housing disputes",
  "Workplace harassment",
  "Police reports",
  "Therapist documentation",
];

const WITHOUT = [
  "Thousands of screenshots",
  "Missing dates",
  "Lost evidence",
  "Overwhelming paperwork",
  "No clear timeline",
];

const WITH = [
  "Organized timeline",
  "Pattern analysis",
  "Searchable evidence",
  "Court-ready reports",
  "Stronger documentation",
];

export function SurvivorSection() {
  const [pos, setPos] = useState(0);
  return (
    <section
      id="survivors"
      style={{
        position: "relative",
        padding: "clamp(80px, 10vw, 140px) 24px",
        background:
          "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(230,139,214,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(111,214,224,0.15), transparent 60%), linear-gradient(180deg, #F4EEE2 0%, #EDE5D6 100%)",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Logo variant="survivor" size={36} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9B7BE8", fontWeight: 700 }}>
            For survivors
          </span>
        </div>

        {/* Emotional hero */}
        <h2 style={{
          fontSize: "clamp(2rem, 5vw, 4rem)",
          fontFamily: "'Newsreader', Georgia, serif",
          fontWeight: 300,
          fontStyle: "italic",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 24,
          maxWidth: 820,
          color: "#2A2218",
        }}>
          We can't just hope the truth will prevail.{" "}
          <span style={{
            background: "linear-gradient(100deg, #E68BD6 0%, #9B7BE8 45%, #6FD6E0 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontStyle: "normal",
          }}>
            We have to arm ourselves.
          </span>
        </h2>

        <p style={{
          fontSize: 20,
          lineHeight: 1.7,
          color: "#6B5D4F",
          fontWeight: 500,
          maxWidth: 600,
          marginBottom: 28,
        }}>
          Document every text. Every call. Every email. Every false accusation. Every single interaction — everything.
        </p>
        <p style={{
          fontSize: 18,
          lineHeight: 1.7,
          color: "#6B5D4F",
          fontWeight: 500,
          maxWidth: 600,
          marginBottom: 64,
        }}>
          Pattern Proof extracts the pattern from all of it. Builds your timeline. Generates a court-ready summary backed by the actual texts, calls, and incidents that prove what you already knew.
          <strong style={{ color: "#2A2218", fontWeight: 700 }}> They can lie. The pattern can't.</strong>
        </p>

        {/* Transformation visual */}
        <div className="surv-transform-grid">
          <div className="surv-transform-inputs">
            <TransformChip icon={<MessageSquare size={16} />} label="Text messages" tint="rgba(181,199,240,0.30)" />
            <TransformChip icon={<ImageIcon size={16} />} label="Photos" tint="rgba(196,176,232,0.30)" />
            <TransformChip icon={<Mic size={16} />} label="Voice notes" tint="rgba(158,216,208,0.30)" />
            <TransformChip icon={<FileText size={16} />} label="Court documents" tint="rgba(216,200,240,0.30)" />
            <TransformChip icon={<Calendar size={16} />} label="Incident logs" tint="rgba(189,230,212,0.30)" />
          </div>
          <div className="surv-transform-arrow" aria-hidden="true">
            <ArrowRight size={28} />
          </div>
          <div className="surv-transform-outputs">
            <OutputCard icon={<Calendar size={18} />} title="One organized timeline" />
            <OutputCard icon={<Shield size={18} />} title="Pattern summary" />
            <OutputCard icon={<FileText size={18} />} title="Court-ready packet" />
          </div>
        </div>

        {/* Pattern slider — kept */}
        <div style={{ marginTop: 72 }}>
          <p style={{ fontSize: 16, color: "#3D3832", fontWeight: 600, marginBottom: 16 }}>
            {pos < 50
              ? "Texts, photos, voice notes, memories — disconnected."
              : "One timeline. Clear patterns. Easier to explain."}
          </p>
          <PatternRevealSlider value={pos} onChange={setPos} />
        </div>

        {/* Use case grid */}
        <div style={{ marginTop: 96 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9B7BE8", fontWeight: 700, marginBottom: 12 }}>
            Built for
          </div>
          <h3 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32 }}>
            Every situation that creates a paper trail.
          </h3>
          <div className="surv-usecase-grid">
            {USE_CASES.map((u) => (
              <div
                key={u}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(196,176,232,0.25)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1A1714",
                }}
              >
                {u}
              </div>
            ))}
          </div>
        </div>

        {/* Before / After */}
        <div style={{ marginTop: 96 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9B7BE8", fontWeight: 700, marginBottom: 12 }}>
            Before vs After
          </div>
          <h3 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 32 }}>
            From overwhelmed to organized.
          </h3>
          <div className="surv-ba-grid">
            <BeforeAfterCard
              title="Without P4TTERN PR00F"
              tone="without"
              items={WITHOUT}
            />
            <BeforeAfterCard
              title="With P4TTERN PR00F"
              tone="with"
              items={WITH}
            />
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 64, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 28px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #E68BD6, #9B7BE8, #6FD6E0)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
              boxShadow: "0 12px 32px -8px rgba(155,123,232,0.45)",
            }}
          >
            Enter Survivor Portal <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function TransformChip({ icon, label, tint }: { icon: React.ReactNode; label: string; tint: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 12,
        background: tint,
        border: "1px solid rgba(255,255,255,0.5)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        fontSize: 14,
        fontWeight: 600,
        color: "#1A1714",
      }}
    >
      <span style={{ color: "#7C5CC4" }}>{icon}</span>
      {label}
    </div>
  );
}

function OutputCard({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,243,255,0.85))",
        border: "1px solid rgba(196,176,232,0.35)",
        boxShadow: "0 10px 28px -10px rgba(124,92,196,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg,#9ED8D0,#C4B0E8)",
          color: "#14171F",
          display: "grid", placeItems: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#14171F" }}>{title}</div>
    </div>
  );
}

function BeforeAfterCard({ title, tone, items }: { title: string; tone: "without" | "with"; items: string[] }) {
  const isWith = tone === "with";
  return (
    <div
      style={{
        padding: 28,
        borderRadius: 20,
        background: isWith
          ? "linear-gradient(160deg, rgba(255,255,255,0.95), rgba(245,250,248,0.9))"
          : "rgba(255,255,255,0.6)",
        border: isWith ? "1px solid rgba(47,141,133,0.30)" : "1px solid rgba(20,23,31,0.10)",
        boxShadow: isWith ? "0 16px 40px -16px rgba(47,141,133,0.30)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: isWith ? "#2F8D85" : "#6B6560",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {items.map((item) => (
          <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 16, fontWeight: 600, color: "#1A1714" }}>
            {isWith ? (
              <CheckCircle2 size={20} style={{ color: "#2F8D85", flexShrink: 0, marginTop: 2 }} />
            ) : (
              <XCircle size={20} style={{ color: "#A89A8E", flexShrink: 0, marginTop: 2 }} />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}