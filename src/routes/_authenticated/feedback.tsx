import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [
      { title: "Share your experience — PatternProof" },
      { name: "description", content: "Tell us how PatternProof is working for you." },
      { property: "og:title", content: "Share your experience — PatternProof" },
      { property: "og:description", content: "Tell us how PatternProof is working for you." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurvivorFeedbackPage,
});

const OVERALL: { value: string; label: string }[] = [
  { value: "much_better", label: "Much better" },
  { value: "better", label: "Better" },
  { value: "same", label: "About the same" },
  { value: "worse", label: "Worse" },
  { value: "much_worse", label: "Much worse" },
];

function SurvivorFeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overall, setOverall] = useState<string>("");
  const [easier, setEasier] = useState("");
  const [harder, setHarder] = useState("");
  const [safetyConcern, setSafetyConcern] = useState<"" | "yes" | "no">("");
  const [safetyDetail, setSafetyDetail] = useState("");
  const [wishlist, setWishlist] = useState("");
  const [followUp, setFollowUp] = useState<"" | "yes" | "no">("");
  const [followUpEmail, setFollowUpEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!overall) {
      toast("Please pick how it's feeling overall.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("feedback_submissions").insert({
      audience: "survivor",
      user_id: user.id,
      responses: {
        overall,
        easier_than_expected: easier.trim() || null,
        confusing_or_stressful: harder.trim() || null,
        safety_concern: safetyConcern || null,
        safety_detail: safetyDetail.trim() || null,
        wishlist: wishlist.trim() || null,
        follow_up_ok: followUp || null,
        follow_up_email: followUp === "yes" ? followUpEmail.trim() || null : null,
      },
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSaving(false);
    if (error) {
      toast("We couldn't save that. Try again in a moment.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 999, background: "rgba(189,230,212,0.35)", color: "#1E5A3E", fontWeight: 700, fontSize: 13, marginBottom: 18 }}>
            <Check size={16} /> Thank you
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", color: "#2A1A10" }}>
            Received. Every word you shared helps.
          </h1>
          <p style={{ color: "#4E3B31", lineHeight: 1.6, marginBottom: 24 }}>
            Your response is stored privately. We only see the words you chose to share here — not anything from your journal or evidence.
          </p>
          <button onClick={() => navigate({ to: "/dashboard" })} style={ctaBtn}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <Link to="/dashboard" style={backLink}><ArrowLeft size={14} /> Back to dashboard</Link>
      <div style={cardStyle}>
        <div style={eyebrow}>Your voice · shared privately</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "10px 0 12px", color: "#2A1A10", fontFamily: "Georgia, 'Palatino Linotype', serif" }}>
          How is PatternProof feeling for you?
        </h1>
        <p style={{ color: "#4E3B31", lineHeight: 1.65, marginBottom: 24 }}>
          Honest answers help us make this safer and easier for the people who come next. Nothing here is required — share what you want, skip what you don't.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 22 }}>
          <Field label="Overall, how do you feel about using PatternProof?">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OVERALL.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOverall(o.value)}
                  style={pillBtn(overall === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="What's one thing that made this easier than you expected?">
            <TextArea value={easier} onChange={setEasier} rows={3} />
          </Field>

          <Field label="What's one thing that felt confusing, overwhelming, or added stress?">
            <TextArea value={harder} onChange={setHarder} rows={3} />
          </Field>

          <Field label="Did you ever feel unsure whether your information was safe?">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["yes", "no"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setSafetyConcern(v)} style={pillBtn(safetyConcern === v)}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
            {safetyConcern === "yes" && (
              <TextArea value={safetyDetail} onChange={setSafetyDetail} rows={2} placeholder="If you're comfortable, what made you unsure?" />
            )}
          </Field>

          <Field label="Is there anything you wish PatternProof did that it doesn't do yet?">
            <TextArea value={wishlist} onChange={setWishlist} rows={3} />
          </Field>

          <Field label="Would you be willing to be contacted for a short follow-up conversation? (optional)">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["yes", "no"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setFollowUp(v)} style={pillBtn(followUp === v)}>
                  {v === "yes" ? "Yes, that's okay" : "No thanks"}
                </button>
              ))}
            </div>
            {followUp === "yes" && (
              <input
                type="email"
                value={followUpEmail}
                onChange={(e) => setFollowUpEmail(e.target.value)}
                placeholder="Email to reach you at"
                style={inputStyle}
              />
            )}
          </Field>

          <div>
            <button type="submit" disabled={saving} style={{ ...ctaBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Sending…" : "Share with the team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#2A1A10", marginBottom: 10, lineHeight: 1.4 }}>{label}</label>
      {children}
    </div>
  );
}

function TextArea({ value, onChange, rows, placeholder }: { value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      maxLength={2000}
      style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
    />
  );
}

/* --- styling (iridescent, matches dashboard/journal warmth) --- */
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: "40px 20px 80px",
  background:
    "radial-gradient(ellipse 70% 55% at 15% 0%, rgba(180,220,220,0.35), transparent 60%), radial-gradient(ellipse 60% 50% at 85% 100%, rgba(220,180,220,0.30), transparent 60%), linear-gradient(180deg, #F5EFE6 0%, #EBDFCE 100%)",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  background: "#DEB896",
  borderRadius: 20,
  padding: "36px 32px",
  boxShadow: "0 20px 60px -30px rgba(78,59,49,0.35)",
  border: "1px solid rgba(255,255,255,0.4)",
};

const backLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#4E3B31",
  textDecoration: "none",
  marginBottom: 20,
  maxWidth: 640,
  marginLeft: "auto",
  marginRight: "auto",
  width: "100%",
  paddingLeft: 4,
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#7A5C4A",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(78,59,49,0.25)",
  background: "#F5E9D6",
  color: "#2A1A10",
  fontSize: 14,
  outline: "none",
};

const ctaBtn: React.CSSProperties = {
  padding: "14px 28px",
  borderRadius: 999,
  background: "#E77B56",
  color: "#FFFFFF",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  boxShadow: "0 8px 24px -12px rgba(231,123,86,0.6)",
};

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 999,
    border: active ? "1px solid #E77B56" : "1px solid rgba(78,59,49,0.25)",
    background: active ? "#E77B56" : "#F5E9D6",
    color: active ? "#FFFFFF" : "#2A1A10",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
}