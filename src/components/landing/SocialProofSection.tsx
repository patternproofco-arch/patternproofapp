import { Quote } from "lucide-react";

// NOTE: Placeholder testimonials have been removed until real, attributable
// partner quotes are collected. Shipping "coming soon" cards on a
// trust-critical product actively hurts credibility. This section now
// presents a single founder statement + a call for design partners.
export function SocialProofSection() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(64px, 8vw, 112px) 24px",
        background: "linear-gradient(180deg, #FAFBFF 0%, #F2F5FA 100%)",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7C5CC4", fontWeight: 700, marginBottom: 14 }}>
          Why this exists
        </div>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Built by someone who lived it.
        </h2>

        <div
          className="card-lift"
          style={{
            padding: 36,
            borderRadius: 20,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(20,23,31,0.08)",
            boxShadow: "0 8px 28px -12px rgba(20,23,31,0.12)",
            textAlign: "left",
          }}
        >
          <Quote size={28} style={{ color: "#7C5CC4", opacity: 0.5 }} />
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#1A1714", fontWeight: 500, marginTop: 12, fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}>
            "I documented everything. Nobody believed me anyway. I walked into that courtroom
            with folders of notes and screenshots and I still couldn't show the pattern.
            I built PatternProof because the evidence was always there — I just needed
            something that could show it."
          </p>
          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: "#3D3832" }}>
            — Grace Burns, founder
          </div>
        </div>

        <p style={{ marginTop: 36, fontSize: 15, color: "#3D3832" }}>
          Attorney, advocate, or organization interested in becoming a launch partner?{" "}
          <a href="/request-org-access" style={{ color: "#7C5CC4", fontWeight: 700 }}>
            Get in touch →
          </a>
        </p>
      </div>
    </section>
  );
}