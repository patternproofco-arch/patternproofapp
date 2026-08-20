import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/org-feedback")({
  head: () => ({
    meta: [
      { title: "DV organization feedback — PatternProof" },
      {
        name: "description",
        content: "Tell us how PatternProof is landing with survivors your organization refers.",
      },
      { property: "og:title", content: "DV organization feedback — PatternProof" },
      {
        property: "og:description",
        content: "Feedback from DV organizations who refer survivors to PatternProof.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrgFeedbackPage,
});

const REFERRAL_EASE = [
  { value: "very_easy", label: "Very easy" },
  { value: "easy", label: "Easy" },
  { value: "neutral", label: "Neutral" },
  { value: "hard", label: "Hard" },
  { value: "very_hard", label: "Very hard" },
  { value: "havent_yet", label: "Haven't referred anyone yet" },
];

function OrgFeedbackPage() {
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ease, setEase] = useState("");
  const [intakeChange, setIntakeChange] = useState("");
  const [refereeBarrier, setRefereeBarrier] = useState("");
  const [funderPitch, setFunderPitch] = useState("");
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ease) {
      setError("Please pick how referrals have felt so far.");
      return;
    }
    setSaving(true);
    const { error: insertErr } = await supabase.from("feedback_submissions").insert({
      audience: "org",
      user_id: null,
      responses: {
        org_name: orgName.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        referral_ease: ease,
        intake_change: intakeChange.trim() || null,
        referral_barrier: refereeBarrier.trim() || null,
        funder_talking_point: funderPitch.trim() || null,
        other: other.trim() || null,
      },
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSaving(false);
    if (insertErr) {
      setError("Couldn't send that. Please try again in a moment.");
      return;
    }
    setDone(true);
  };

  return (
    <div data-persona="org" style={pageWrap}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link to="/" style={backLink}>
          <ArrowLeft size={14} /> Back to PatternProof
        </Link>
        <div style={cardStyle}>
          <BrandLogo size={40} />
          <div style={eyebrow}>DV organizations · your voice matters</div>

          {done ? (
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 2,
                  background: "rgba(127,161,137,0.20)",
                  color: "#3E5A33",
                  fontWeight: 700,
                  fontSize: 13,
                  marginTop: 20,
                }}
              >
                <Check size={16} /> Received
              </div>
              <h1
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  margin: "16px 0 12px",
                  color: "#1F2D1A",
                }}
              >
                Thank you.
              </h1>
              <p style={{ color: "#2C3826", lineHeight: 1.6 }}>
                Advocate feedback shapes what we build next. If you left contact info we'll follow
                up personally.
              </p>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  margin: "14px 0 12px",
                  color: "#1F2D1A",
                }}
              >
                How is PatternProof landing with your survivors?
              </h1>
              <p style={{ color: "#2C3826", lineHeight: 1.65, marginBottom: 24 }}>
                A few short questions. Skip anything you'd rather not answer. Your organization name
                and contact info are optional — leave them blank to respond anonymously.
              </p>

              <form onSubmit={submit} style={{ display: "grid", gap: 20 }}>
                <OField label="Organization name (optional)">
                  <OInput value={orgName} onChange={setOrgName} />
                </OField>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <OField label="Your name (optional)">
                    <OInput value={contactName} onChange={setContactName} />
                  </OField>
                  <OField label="Email (optional)">
                    <OInput value={contactEmail} onChange={setContactEmail} type="email" />
                  </OField>
                </div>

                <OField label="How easy was it to refer a survivor to PatternProof?">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {REFERRAL_EASE.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setEase(o.value)}
                        style={pillBtn(ease === o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </OField>

                <OField label="Have you noticed any change in how survivors show up to intake after using PatternProof first?">
                  <OTextArea value={intakeChange} onChange={setIntakeChange} rows={3} />
                </OField>

                <OField label="What would make it easier for your organization to refer more survivors?">
                  <OTextArea value={refereeBarrier} onChange={setRefereeBarrier} rows={3} />
                </OField>

                <OField label="Is there anything about PatternProof you'd want to be able to tell your funders or board?">
                  <OTextArea value={funderPitch} onChange={setFunderPitch} rows={3} />
                </OField>

                <OField label="Anything else? (optional)">
                  <OTextArea value={other} onChange={setOther} rows={3} />
                </OField>

                {error && (
                  <div style={{ color: "#8B3A3A", fontSize: 13, fontWeight: 600 }}>{error}</div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ ...ctaBtn, opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 700,
          color: "#1F2D1A",
          marginBottom: 8,
          lineHeight: 1.45,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
function OInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={300}
      style={inputStyle}
    />
  );
}
function OTextArea({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      maxLength={2000}
      style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
    />
  );
}

/* --- sage-green styling matching OrgSection --- */
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: "60px 24px 100px",
  background: "#FAF8F4",
};
const cardStyle: React.CSSProperties = {
  background: "var(--pp-card)",
  borderRadius: 2,
  padding: "36px 32px",
  borderLeft: "4px solid #7A9B6E",
  boxShadow: "var(--pp-shadow-sm)",
};
const backLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#3E5A33",
  textDecoration: "none",
  marginBottom: 20,
};
const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#3E5A33",
  fontWeight: 700,
  marginTop: 20,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 2,
  border: "1px solid rgba(62,90,51,0.20)",
  background: "#F6F8F1",
  color: "#1F2D1A",
  fontSize: 14,
  outline: "none",
};
const ctaBtn: React.CSSProperties = {
  padding: "14px 26px",
  borderRadius: 2,
  background: "#2F4E34",
  color: "#1A1224",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  boxShadow: "var(--pp-shadow-sm)",
};
function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 2,
    border: active ? "1px solid #2F4E34" : "1px solid rgba(62,90,51,0.25)",
    background: active ? "#2F4E34" : "#FFFFFF",
    color: active ? "#1A1224" : "#1F2D1A",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "inherit",
  };
} // touch
