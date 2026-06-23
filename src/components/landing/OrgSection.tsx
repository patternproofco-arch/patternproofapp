import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, TrendingUp, Users, Activity, Heart, Award, BarChart3 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { OrgCapacityCalculator } from "./OrgCapacityCalculator";

const BENEFITS = [
  "Faster intake",
  "Better documentation",
  "Stronger referrals",
  "Improved survivor outcomes",
  "Reduced advocate burnout",
  "Increased organizational capacity",
];

const GRANT_METRICS = [
  { icon: <Users size={20} />, label: "Survivors served", desc: "Track active and cumulative reach." },
  { icon: <Check size={20} />, label: "Documentation completed", desc: "Measure case-readiness output." },
  { icon: <ArrowRight size={20} />, label: "Referrals made", desc: "Quantify legal and community handoffs." },
  { icon: <Activity size={20} />, label: "Advocate hours recovered", desc: "Operational time saved per quarter." },
  { icon: <Award size={20} />, label: "Program outcomes", desc: "Outcome-aligned reporting for funders." },
  { icon: <Heart size={20} />, label: "Community impact", desc: "Aggregate impact across cohorts." },
];

export function OrgSection() {
  return (
    <section
      id="organizations"
      style={{
        position: "relative",
        padding: "clamp(80px, 10vw, 140px) 24px",
        background:
          "radial-gradient(ellipse 60% 50% at 90% 0%, rgba(61,114,184,0.15), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 100%, rgba(168,204,224,0.18), transparent 60%), linear-gradient(180deg, #F2F5FA 0%, #E4ECF5 100%)",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Logo variant="org" size={36} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1E3A5F", fontWeight: 700 }}>
            For DV organizations
          </span>
        </div>
        <h2
          style={{
            fontSize: "clamp(2rem, 5vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: 24,
            maxWidth: 900,
            color: "#0E1B36",
          }}
        >
          Advocates shouldn't have to{" "}
          <span
            style={{
              background: "linear-gradient(90deg,#3D72B8,#1E3A5F)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            rebuild every story.
          </span>
        </h2>
        <p
          style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: "#2E3340",
            fontWeight: 500,
            maxWidth: 660,
            marginBottom: 56,
          }}
        >
          Survivors document before intake. Advocates see the pattern faster.
        </p>

        {/* Benefits */}
        <div className="org-benefits-grid" style={{ marginBottom: 80 }}>
          {BENEFITS.map((b) => (
            <div
              key={b}
              style={{
                padding: "18px 20px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(61,114,184,0.15)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Check size={18} style={{ color: "#3D72B8", flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#14171F" }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Grant section */}
        <div
          style={{
            padding: "clamp(32px, 4vw, 56px)",
            borderRadius: 28,
            background: "linear-gradient(160deg, #FFFFFF 0%, #F8FAFD 100%)",
            border: "1px solid rgba(61,114,184,0.18)",
            boxShadow: "0 20px 60px -20px rgba(30,58,95,0.18)",
            marginBottom: 72,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(61,114,184,0.10)", color: "#1E3A5F", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16 }}>
            <BarChart3 size={12} /> Grant-funded programs
          </div>
          <h3 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#0E1B36", marginBottom: 16 }}>
            Built for grant-funded programs.
          </h3>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "#3D3832", maxWidth: 680, marginBottom: 36 }}>
            P4TTERN PR00F helps organizations demonstrate measurable outcomes to funders and stakeholders.
          </p>
          <div className="org-metrics-grid">
            {GRANT_METRICS.map((m) => (
              <div
                key={m.label}
                style={{
                  padding: 22,
                  borderRadius: 16,
                  background: "linear-gradient(160deg, rgba(61,114,184,0.04), rgba(168,204,224,0.06))",
                  border: "1px solid rgba(61,114,184,0.12)",
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "linear-gradient(135deg,#A8CCE0,#3D72B8)",
                    color: "#FFFFFF",
                    display: "grid", placeItems: "center", marginBottom: 14,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0E1B36", marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 14, color: "#3D3832", lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Capacity calculator */}
        <div style={{ marginBottom: 56 }}>
          <OrgCapacityCalculator />
        </div>

        {/* Invite CTA */}
        <div
          style={{
            padding: 36,
            borderRadius: 24,
            background: "linear-gradient(160deg, #0E1B36 0%, #1B2A4A 100%)",
            color: "#FFFFFF",
            textAlign: "center",
            boxShadow: "0 20px 60px -20px rgba(14,27,54,0.5)",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#9CB3E8", fontWeight: 700, marginBottom: 12 }}>
            Invite-only
          </div>
          <h3 style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)", fontWeight: 800, color: "#FFFFFF", marginBottom: 16, letterSpacing: "-0.015em" }}>
            Org access is invite-only.
          </h3>
          <p style={{ fontSize: 16, color: "rgba(226,232,240,0.78)", maxWidth: 480, margin: "0 auto 24px" }}>
            We partner with a small number of DV organizations each quarter.
          </p>
          <Link
            to="/request-org-access"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 26px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: "#0E1B36",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Request org access <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Compatibility — unused but keep export name TrendingUp import optional
void TrendingUp;