import { Quote } from "lucide-react";

const SLOTS: { audience: string; quote: string; cite: string; tone: "survivor" | "attorney" | "org" }[] = [
  {
    audience: "Attorney",
    quote: "Testimonial coming soon — early partner attorneys are saving 4–6 hours per client on evidence intake.",
    cite: "Family Law Partner",
    tone: "attorney",
  },
  {
    audience: "Survivor",
    quote: "Testimonial coming soon — survivors describe finally being able to show, not just tell.",
    cite: "PatternProof user",
    tone: "survivor",
  },
  {
    audience: "DV Organization",
    quote: "Testimonial coming soon — advocates can spend more time on care, less on paperwork.",
    cite: "Executive Director",
    tone: "org",
  },
];

export function SocialProofSection() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(64px, 8vw, 112px) 24px",
        background: "linear-gradient(180deg, #FAFBFF 0%, #F2F5FA 100%)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7C5CC4", fontWeight: 700, marginBottom: 14 }}>
          Trusted by
        </div>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            marginBottom: 16,
            maxWidth: 760,
          }}
        >
          Early partners across three communities.
        </h2>
        <p style={{ fontSize: 18, color: "#3D3832", maxWidth: 600, marginBottom: 48 }}>
          Survivor stories, attorney testimonials, and organization case studies — coming as our launch partners go live.
        </p>

        <div className="social-proof-grid">
          {SLOTS.map((s) => (
            <ProofCard key={s.audience} {...s} />
          ))}
        </div>

        {/* Logo strip placeholder */}
        <div
          style={{
            marginTop: 56,
            padding: "28px 24px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.7)",
            border: "1px dashed rgba(20,23,31,0.12)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#6B6560", fontWeight: 700, marginBottom: 10 }}>
            Partner logos
          </div>
          <p style={{ fontSize: 14, color: "#3D3832", margin: 0 }}>
            Law firm, DV organization, and university partner logos will appear here.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProofCard({ audience, quote, cite, tone }: { audience: string; quote: string; cite: string; tone: "survivor" | "attorney" | "org" }) {
  const accents = {
    survivor: { dot: "linear-gradient(135deg,#9ED8D0,#C4B0E8)", color: "#7C5CC4" },
    attorney: { dot: "#0F1B3D", color: "#1E3A5F" },
    org: { dot: "#3D72B8", color: "#1E3A5F" },
  }[tone];
  return (
    <div
      className="card-lift"
      style={{
        padding: 28,
        borderRadius: 20,
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(20,23,31,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 28px -12px rgba(20,23,31,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accents.dot }} />
        <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: accents.color, fontWeight: 700 }}>
          {audience}
        </span>
      </div>
      <Quote size={28} style={{ color: accents.color, opacity: 0.5 }} />
      <p style={{ fontSize: 16, lineHeight: 1.6, color: "#1A1714", fontWeight: 500, margin: 0, flex: 1 }}>
        {quote}
      </p>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#3D3832" }}>— {cite}</div>
    </div>
  );
}