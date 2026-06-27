import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Zap, Search, Brain, FileCheck, Users, Sparkles, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AttorneyROICalculator } from "./AttorneyROICalculator";

const BENEFITS = [
  { icon: <Clock size={18} />, text: "No rebuilding timelines from screenshots" },
  { icon: <Search size={18} />, text: "Faster evidence review" },
  { icon: <Brain size={18} />, text: "Pattern detection across months of communication" },
  { icon: <FileCheck size={18} />, text: "Attorney-ready summaries" },
  { icon: <Users size={18} />, text: "Reduced paralegal workload" },
  { icon: <Sparkles size={18} />, text: "Better client preparation" },
  { icon: <Zap size={18} />, text: "Stronger hearing packets" },
];

export function AttorneySection() {
  return (
    <section
      id="attorneys"
      style={{
        position: "relative",
        padding: "clamp(80px, 10vw, 140px) 24px",
        background:
          "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(196,176,232,0.10), transparent 60%), linear-gradient(180deg, #071426 0%, #0F1B3D 50%, #1B2A4A 100%)",
        color: "#E2E8F0",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Logo variant="attorney" size={36} onDark />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9CB3E8", fontWeight: 700 }}>
            For attorneys
          </span>
        </div>

        {/* Headline */}
        <h2
          style={{
            fontSize: "clamp(2.2rem, 5vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#FFFFFF",
            marginBottom: 24,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Every hour sorting screenshots is an hour{" "}
          <span
            style={{
              background: "linear-gradient(90deg,#9ED8D0,#B5C7F0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            you're not getting paid for.
          </span>
        </h2>

        {/* Pain statement */}
        <div
          style={{
            fontSize: 20,
            lineHeight: 1.65,
            color: "rgba(226,232,240,0.85)",
            maxWidth: 680,
            marginBottom: 24,
            fontWeight: 500,
          }}
        >
          <p style={{ margin: "0 0 12px" }}>
            Your client's 4 months of texts arrive as 600 screenshots. Her incident log lives in three different apps. Your paralegal spends 8–12 hours building the timeline you need — at rates that eat the file.
          </p>
          <p style={{ margin: 0 }}>
            Disorganized evidence doesn't just waste time. Gaps in a timeline gap credibility. Judges notice.
          </p>
        </div>

        {/* Intro paragraph */}
        <p
          style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: "rgba(226,232,240,0.85)",
            maxWidth: 660,
            marginBottom: 56,
            fontWeight: 500,
          }}
        >
          Transform disorganized client evidence into structured case intelligence before it reaches your desk.
        </p>

        {/* Calculator */}
        <div id="att-calc" style={{ marginBottom: 72 }}>
          <AttorneyROICalculator />
        </div>

        {/* Benefits grid */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9CB3E8", fontWeight: 700, marginBottom: 12 }}>
            What you get
          </div>
          <h3 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", marginBottom: 32 }}>
            Built for the work you'd rather not do.
          </h3>
          <div className="att-benefits-grid">
            {BENEFITS.map((b) => (
              <div
                key={b.text}
                style={{
                  padding: "20px 22px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(181,199,240,0.14)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(158,216,208,0.22), rgba(181,199,240,0.22))",
                    color: "#9ED8D0",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}
                >
                  {b.icon}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", lineHeight: 1.5 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        <blockquote
          style={{
            margin: "0 0 72px",
            padding: "32px 36px",
            borderRadius: 20,
            background: "linear-gradient(135deg, rgba(158,216,208,0.08), rgba(181,199,240,0.04))",
            borderLeft: "4px solid #9ED8D0",
            fontSize: "clamp(20px, 2vw, 26px)",
            lineHeight: 1.4,
            color: "#FFFFFF",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            fontStyle: "italic",
            maxWidth: 800,
          }}
        >
          "Every hour spent organizing evidence is an hour not spent practicing law."
        </blockquote>

        {/* Comparison */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9CB3E8", fontWeight: 700, marginBottom: 12 }}>
            The math
          </div>
          <h3 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", marginBottom: 32 }}>
            The hours add up.
          </h3>
          <div className="att-compare-grid">
            <div
              style={{
                padding: 32, borderRadius: 20,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(226,232,240,0.6)", fontWeight: 700, marginBottom: 16 }}>
                Without P4TTERN PR00F
              </div>
              <div style={{ display: "grid", gap: 18 }}>
                <BigStat n="5" label="Clients" />
                <BigStat n="6 hrs" label="Each" />
                <BigStat n="30 hrs" label="Lost per month" highlight={false} muted />
              </div>
            </div>
            <div
              style={{
                padding: 32, borderRadius: 20,
                background: "linear-gradient(160deg, rgba(158,216,208,0.10), rgba(181,199,240,0.06))",
                border: "1px solid rgba(158,216,208,0.30)",
                boxShadow: "0 20px 60px -20px rgba(158,216,208,0.25)",
              }}
            >
              <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9ED8D0", fontWeight: 700, marginBottom: 16 }}>
                With P4TTERN PR00F
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
                {["Organized timeline", "Evidence index", "Pattern summary", "Attorney-ready packet"].map((x) => (
                  <li key={x} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, fontWeight: 600, color: "#FFFFFF" }}>
                    <Check size={20} style={{ color: "#9ED8D0", flexShrink: 0 }} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Pricing — bottom of section, reduced weight */}
        <div
          style={{
            padding: "28px 32px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(181,199,240,0.14)",
            marginBottom: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#9CB3E8", fontWeight: 700, marginBottom: 8 }}>
              Pricing
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1 }}>
              $297<span style={{ fontSize: 14, color: "#9CB3E8", fontWeight: 600 }}>/month</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginTop: 4 }}>
              Less than one billable hour.
            </div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(226,232,240,0.78)", maxWidth: 400, margin: 0 }}>
            Recover hours of administrative work, accelerate case preparation, and spend more time practicing law.
          </p>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to="/lawyer-signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "18px 32px",
              borderRadius: 999,
              background: "linear-gradient(90deg,#9ED8D0,#B5C7F0)",
              color: "#0F1B3D",
              fontWeight: 800,
              fontSize: 16,
              textDecoration: "none",
              boxShadow: "0 12px 32px -8px rgba(158,216,208,0.45)",
            }}
          >
            Stop paying your team to untangle screenshots <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function BigStat({ n, label, highlight, muted }: { n: string; label: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: "clamp(2rem, 4vw, 3rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: muted ? "#9CB3E8" : highlight ? "#9ED8D0" : "#FFFFFF",
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 13, color: "rgba(226,232,240,0.7)", fontWeight: 600, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
