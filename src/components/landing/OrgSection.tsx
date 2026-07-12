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
          "radial-gradient(ellipse 70% 55% at 85% 0%, rgba(140,180,120,0.32), transparent 60%), radial-gradient(ellipse 70% 55% at 15% 100%, rgba(168,194,155,0.28), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(120,160,100,0.14), transparent 70%), linear-gradient(180deg, #EFF3E8 0%, #DCE7D2 60%, #C9D8BB 100%)",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Logo variant="org" size={44} />
          <span style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#3E5A33", fontWeight: 700 }}>
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
            color: "#1F2D1A",
          }}
        >
          Advocates shouldn't have to{" "}
          <span
            style={{
              background: "linear-gradient(90deg,#7A9B6E,#3E5A33)",
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
            color: "#2C3826",
            fontWeight: 500,
            maxWidth: 660,
            marginBottom: 28,
          }}
        >
          Survivors document before intake. Advocates see the pattern faster.
        </p>

        {/* DocuSafe replacement callout */}
        <div
          style={{
            maxWidth: 480,
            marginBottom: 56,
            padding: "24px 28px",
            borderRadius: 16,
            background: "#FFFFFF",
            borderLeft: "4px solid #7A9B6E",
            boxShadow: "0 8px 32px -12px rgba(62,90,51,0.22)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#5A7A4F",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            DocuSafe replacement
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "#2C3826", marginBottom: 12, fontWeight: 500 }}>
            DocuSafe closed in October 2023 when DOJ funding ended. The tool that hundreds of DV organizations relied on to help survivors document evidence is gone.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "#2C3826", marginBottom: 12, fontWeight: 600 }}>
            Pattern Proof is what comes next.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#36422F" }}>
            Everything DocuSafe did — incident logging, timeline building, evidence organization — plus AI-powered pattern detection, mobile-first design, and court-ready export. No grant dependency. No sunset date.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#36422F", marginTop: 8, fontWeight: 600 }}>
            If your organization used DocuSafe, this is your replacement. Free for every survivor you serve.
          </p>
        </div>

        {/* Benefits */}
        <div className="org-benefits-grid" style={{ marginBottom: 80 }}>
          {BENEFITS.map((b) => (
            <div
              key={b}
              style={{
                padding: "18px 20px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(122,155,110,0.25)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Check size={18} style={{ color: "#5A7A4F", flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#1F2D1A" }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Grant section */}
        <div
          style={{
            padding: "clamp(32px, 4vw, 56px)",
            borderRadius: 28,
            background: "linear-gradient(160deg, #FFFFFF 0%, #F4F8EE 100%)",
            border: "1px solid rgba(122,155,110,0.25)",
            boxShadow: "0 20px 60px -20px rgba(62,90,51,0.22)",
            marginBottom: 72,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(122,155,110,0.15)", color: "#3E5A33", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16 }}>
            <BarChart3 size={12} /> Grant-funded programs
          </div>
          <h3 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#1F2D1A", marginBottom: 16 }}>
            Built for grant-funded programs.
          </h3>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: "#36422F", maxWidth: 680, marginBottom: 36 }}>
            PatternProof helps organizations demonstrate measurable outcomes to funders and stakeholders.
          </p>
          <div className="org-metrics-grid">
            {GRANT_METRICS.map((m) => (
              <div
                key={m.label}
                style={{
                  padding: 22,
                  borderRadius: 16,
                  background: "linear-gradient(160deg, rgba(122,155,110,0.06), rgba(168,194,155,0.10))",
                  border: "1px solid rgba(122,155,110,0.20)",
                }}
              >
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "linear-gradient(135deg,#A8C29B,#5A7A4F)",
                    color: "#FFFFFF",
                    display: "grid", placeItems: "center", marginBottom: 14,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1F2D1A", marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 14, color: "#36422F", lineHeight: 1.5 }}>{m.desc}</div>
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
            background: "radial-gradient(ellipse 80% 70% at 50% 0%, rgba(140,180,120,0.35), transparent 65%), linear-gradient(160deg, #28341F 0%, #3E5A33 100%)",
            color: "#FFFFFF",
            textAlign: "center",
            boxShadow: "0 20px 60px -20px rgba(40,52,31,0.55), 0 0 80px -30px rgba(140,180,120,0.35)",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#C5DBB0", fontWeight: 700, marginBottom: 12 }}>
            Invite-only
          </div>
          <h3 style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)", fontWeight: 800, color: "#FFFFFF", marginBottom: 16, letterSpacing: "-0.015em" }}>
            Org access is invite-only.
          </h3>
          <p style={{ fontSize: 16, color: "rgba(232,240,222,0.85)", maxWidth: 480, margin: "0 auto 24px" }}>
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
              color: "#28341F",
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