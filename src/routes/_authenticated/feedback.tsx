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
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 18,
              background: "rgba(127,161,137,0.20)",
              color: "#0F6E56",
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            <Check size={16} /> Thank you
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", color: "#1A1224" }}>
            Received. Every word you shared helps.
          </h1>
          <p style={{ color: "#4E3B31", lineHeight: 1.6, marginBottom: 24 }}>
            Your response is stored privately. We only see the words you chose to share here — not
            anything from your Archive or evidence.
          </p>
          <button onClick={() => navigate({ to: "/dashboard" })} style={ctaBtn}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <Link to="/dashboard" style={backLink}>
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <div style={cardStyle}>
        <div style={eyebrow}>Your voice · shared privately</div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "10px 0 12px",
            color: "#1A1224",
            fontFamily: "Georgia, 'Palatino Linotype', serif",
          }}
        >
          How is PatternProof feeling for you?
        </h1>
        <p style={{ color: "#4E3B31", lineHeight: 1.65, marginBottom: 24 }}>
          Honest answers help us make this safer and easier for the people who come next. Nothing
          here is required — share what you want, skip what you don't.
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
                <button
                  key={v}
                  type="button"
                  onClick={() => setSafetyConcern(v)}
                  style={pillBtn(safetyConcern === v)}
                >
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
            {safetyConcern === "yes" && (
              <TextArea
                value={safetyDetail}
                onChange={setSafetyDetail}
                rows={2}
                placeholder="If you're comfortable, what made you unsure?"
              />
            )}
          </Field>

          <Field label="Is there anything you wish PatternProof did that it doesn't do yet?">
            <TextArea value={wishlist} onChange={setWishlist} rows={3} />
          </Field>

          <Field label="Would you be willing to be contacted for a short follow-up conversation? (optional)">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["yes", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFollowUp(v)}
                  style={pillBtn(followUp === v)}
                >
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
            <button
              type="submit"
              disabled={saving}
              style={{ ...ctaBtn, opacity: saving ? 0.7 : 1 }}
            >
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
      <label
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 700,
          color: "#1A1224",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
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
  background: "#FAF8F4",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  background: "#FAF8F4",
  borderRadius: 18,
  padding: "36px 32px",
  boxShadow: "var(--pp-shadow-sm)",
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
  borderRadius: 18,
  border: "1px solid rgba(26,18,36,0.25)",
  background: "#FAF8F4",
  color: "#1A1224",
  fontSize: 14,
  outline: "none",
};

const ctaBtn: React.CSSProperties = {
  padding: "14px 28px",
  borderRadius: 18,
  background: "var(--pp-accent)",
  color: "#FFFFFF",
  fontWeight: 700,
  fontSize: 15,
  border: "none",
  cursor: "pointer",
  boxShadow: "var(--pp-shadow-sm)",
};

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 18,
    border: active ? "1px solid var(--pp-accent)" : "1px solid rgba(26,18,36,0.25)",
    background: active ? "var(--pp-accent)" : "#FAF8F4",
    color: active ? "#FFFFFF" : "#1A1224",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
}
