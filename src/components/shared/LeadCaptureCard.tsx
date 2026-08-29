import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { submitMarketingLead } from "@/lib/marketing-leads.functions";
import { ThreadConnector } from "@/components/ThreadConnector";

const SANS = "var(--font-sans)";
const SERIF = "var(--font-serif)";
const MONO = "var(--font-mono)";
const MUTED = "var(--pp-muted)";
const INK = "var(--pp-ink)";

interface LeadCaptureCardProps {
  persona: "attorney" | "org";
  accent: string;
  kitName: string;
  description: string;
  sourcePage: string;
}

/**
 * Compact, persona-themed lead-capture card for the two marketing pages
 * that offer a free readiness kit. Phone is collected here (attorney/org
 * only, never on a survivor-facing route — the persona prop itself only
 * accepts "attorney" | "org").
 */
export function LeadCaptureCard({
  persona,
  accent,
  kitName,
  description,
  sourcePage,
}: LeadCaptureCardProps) {
  const submit = useServerFn(submitMarketingLead);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Add an email so we know where to send it.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const r = await submit({
        data: {
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          persona,
          sourcePage,
        },
      });
      if (r.ok) {
        setDone(true);
      } else {
        setErrorMsg("Something went wrong on our end. Try again in a moment.");
      }
    } catch {
      setErrorMsg("Something went wrong on our end. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThreadConnector orientation="vertical-behind">
      <div
        style={{
          borderRadius: "var(--pp-r-lg)",
          background: "var(--pp-card)",
          boxShadow: "var(--pp-shadow-up)",
          padding: "28px 26px",
          fontFamily: SANS,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: accent,
            marginBottom: 10,
          }}
        >
          Free download
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "clamp(1.4rem,3vw,1.9rem)",
            lineHeight: 1.2,
            color: INK,
            marginBottom: 10,
          }}
        >
          {kitName}
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: MUTED, margin: "0 0 20px", maxWidth: 520 }}>
          {description} Genuinely free, no obligation — we'll email it to you and nothing else
          unless you ask.
        </p>

        {done ? (
          <div
            style={{
              borderRadius: "var(--pp-r-lg)",
              background: "var(--pp-ground)",
              boxShadow: "var(--pp-shadow-in-sm)",
              padding: "16px 18px",
              fontSize: 14,
              color: INK,
            }}
          >
            Sent — check your inbox for the kit.
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <input
                className="input-pp"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ gridColumn: "1 / -1" }}
              />
              <input
                className="input-pp"
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ gridColumn: "1 / -1" }}
              />
              <input
                className="input-pp"
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ gridColumn: "1 / -1" }}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                justifySelf: "start",
                background: accent,
                color: "#F4F6FB",
                padding: "12px 22px",
                fontFamily: MONO,
                fontSize: 13,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: 0,
                borderRadius: "var(--pp-r-pill)",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Sending…" : "Send me the kit →"}
            </button>
            {errorMsg ? (
              <div style={{ fontSize: 12.5, color: accent }}>{errorMsg}</div>
            ) : null}
          </form>
        )}
      </div>
    </ThreadConnector>
  );
}
