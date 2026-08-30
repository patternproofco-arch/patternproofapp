import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { requestProfessionalReadinessKit } from "@/lib/marketing-leads.functions";

export function ProfessionalReadinessKitCapture() {
  const location = useLocation();
  const config = useMemo(() => {
    if (location.pathname === "/for-attorneys") {
      return {
        persona: "attorney" as const,
        sourcePage: "/for-attorneys" as const,
        title: "Evidence Intake & Chronology Readiness Kit",
        description:
          "A one-page intake checklist for source-linking, date certainty, evidence handling, and professional review.",
      };
    }
    if (location.pathname === "/for-organizations") {
      return {
        persona: "org" as const,
        sourcePage: "/for-organizations" as const,
        title: "Survivor Referral & Consent Readiness Kit",
        description:
          "A one-page referral checklist covering consent language, staff visibility, role boundaries, and revocation.",
      };
    }
    return null;
  }, [location.pathname]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!config) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setStatus("sending");
    try {
      const result = await requestProfessionalReadinessKit({
        data: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          persona: config.persona,
          sourcePage: config.sourcePage,
        },
      });
      setStatus(result.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      data-persona={config.persona}
      aria-labelledby="professional-kit-title"
      style={{
        maxWidth: 780,
        margin: "0 auto 72px",
        padding: "0 24px",
        fontFamily: "var(--font-sans)",
        color: "var(--pp-ink)",
      }}
    >
      <div
        className="card-pp"
        style={{
          padding: "clamp(22px,4vw,34px)",
          borderRadius: "var(--pp-r-lg)",
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-up)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--pp-muted)",
          }}
        >
          Free professional resource
        </div>
        <h2
          id="professional-kit-title"
          style={{
            margin: "10px 0 8px",
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.6rem,3.5vw,2.25rem)",
            lineHeight: 1.15,
          }}
        >
          {config.title}
        </h2>
        <p style={{ margin: "0 0 22px", color: "var(--pp-muted)", lineHeight: 1.6 }}>
          {config.description}
        </p>

        {status === "sent" ? (
          <div role="status" style={{ lineHeight: 1.6 }}>
            <strong>Request received.</strong> Check {email} for the kit. If delivery is delayed, your request is still saved.
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
            <label style={labelStyle}>
              Name
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Email
              <input
                required
                type="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Phone <span style={{ color: "var(--pp-muted)", fontWeight: 400 }}>(optional, for scheduling a walkthrough)</span>
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                style={inputStyle}
              />
            </label>
            <button
              type="submit"
              disabled={status === "sending" || !name.trim() || !email.trim()}
              className="pp-btn pp-btn-primary"
              style={{ justifySelf: "start", marginTop: 4 }}
            >
              {status === "sending" ? "Sending…" : "Email me the kit"}
            </button>
            {status === "error" && (
              <p role="alert" style={{ margin: 0, color: "var(--pp-muted)", fontSize: 13 }}>
                We couldn't send the kit right now. Your information was not added to a marketing list; try again in a moment.
              </p>
            )}
            <p style={{ margin: 0, color: "var(--pp-muted)", fontSize: 12.5, lineHeight: 1.55 }}>
              One-time resource delivery only. No pre-checked marketing consent and no automatic newsletter enrollment. Phone is optional.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
} as const;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "none",
  outline: "none",
  borderRadius: "var(--pp-r-md, 14px)",
  padding: "12px 14px",
  background: "var(--pp-ground)",
  color: "var(--pp-ink)",
  boxShadow: "var(--pp-shadow-in)",
  font: "inherit",
};
