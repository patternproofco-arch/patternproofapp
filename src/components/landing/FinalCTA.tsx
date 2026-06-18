import { Link } from "@tanstack/react-router";

export function FinalCTA() {
  return (
    <section
      style={{
        padding: "96px 24px",
        textAlign: "center",
        background: "linear-gradient(135deg, #14171F 0%, #2A2F4A 100%)",
        color: "#FFFFFF",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h2 style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", lineHeight: 1.1, marginBottom: 20 }}>
          Stop searching through the chaos. Start seeing the pattern.
        </h2>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.78)", marginBottom: 36 }}>
          For survivors, attorneys, and advocates working with complex abuse and custody documentation.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            to="/login"
            style={{ padding: "14px 24px", borderRadius: 999, background: "linear-gradient(90deg, var(--teal-dark), var(--purple-dark))", color: "#FFFFFF", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            Start documenting
          </Link>
          <Link
            to="/lawyer-signup"
            style={{ padding: "14px 24px", borderRadius: 999, background: "#FFFFFF", color: "#0F1B3D", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            Start attorney beta
          </Link>
          <Link
            to="/request-org-access"
            style={{ padding: "14px 24px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", color: "#FFFFFF", fontWeight: 700, fontSize: 15, textDecoration: "none" }}
          >
            Request DV org access
          </Link>
        </div>
        <p style={{ marginTop: 40, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          P4TTERN PR00F is not an emergency service. If you are in immediate danger, call 911 or your local crisis line.
        </p>
      </div>
    </section>
  );
}