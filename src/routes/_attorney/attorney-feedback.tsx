import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_attorney/attorney-feedback")({
  head: () => ({
    meta: [
      { title: "Attorney feedback — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AttorneyFeedbackPage,
});

const TIME_SAVED = [
  { value: "none", label: "None" },
  { value: "under_1h", label: "Under 1 hour" },
  { value: "1_3h", label: "1–3 hours" },
  { value: "3_10h", label: "3–10 hours" },
  { value: "10h_plus", label: "10+ hours" },
];

function AttorneyFeedbackPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeSaved, setTimeSaved] = useState("");
  const [accuracy, setAccuracy] = useState("");
  const [missing, setMissing] = useState("");
  const [nps, setNps] = useState<number | null>(null);
  const [firmUpgrade, setFirmUpgrade] = useState("");
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("feedback_submissions").insert({
      audience: "attorney",
      user_id: user.id,
      responses: {
        time_saved: timeSaved || null,
        pattern_accuracy: accuracy.trim() || null,
        missing_for_case: missing.trim() || null,
        nps_score: nps,
        firm_upgrade_blocker: firmUpgrade.trim() || null,
        other: other.trim() || null,
      },
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSaving(false);
    if (error) {
      alert("Could not save feedback. Try again in a moment.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div className="att-card" style={{ padding: 32, textAlign: "left" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 2,
              background: "rgba(16,185,129,0.10)",
              color: "var(--att-green)",
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            <Check size={14} /> Received
          </div>
          <h1 className="att-page-title">Thank you.</h1>
          <p style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 20 }}>
            Product feedback goes directly to the team building PatternProof. If you flagged
            something urgent, we'll follow up.
          </p>
          <button onClick={() => navigate({ to: "/clients" })} className="att-btn-primary">
            Back to caseload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      <div>
        <div className="att-eyebrow">Product feedback</div>
        <h1 className="att-page-title">Attorney feedback</h1>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 6, maxWidth: 620 }}>
          Six short questions. Answers are stored privately and reviewed by the product team.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="att-card"
        style={{ padding: 28, display: "grid", gap: 22 }}
      >
        <AField label="Roughly how much time do you estimate PatternProof saved you on this case, compared to organizing evidence manually?">
          <select
            value={timeSaved}
            onChange={(e) => setTimeSaved(e.target.value)}
            style={selectStyle}
            required
          >
            <option value="">Select…</option>
            {TIME_SAVED.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </AField>

        <AField label="Did the pattern analysis and severity indicators feel accurate and well-supported, or did anything feel overstated?">
          <ATextArea value={accuracy} onChange={setAccuracy} rows={3} />
        </AField>

        <AField label="Was anything missing that you needed for this case?">
          <ATextArea value={missing} onChange={setMissing} rows={3} />
        </AField>

        <AField label="How likely are you to recommend PatternProof to another family law attorney?">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNps(n)}
                style={{
                  minWidth: 40,
                  padding: "8px 10px",
                  borderRadius: 2,
                  border: nps === n ? "1px solid var(--att-navy)" : "1px solid var(--att-border)",
                  background: nps === n ? "var(--att-navy)" : "#FFFFFF",
                  color: nps === n ? "#FFFFFF" : "var(--att-text)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--att-text-2)",
              marginTop: 6,
            }}
          >
            <span>0 · Not at all likely</span>
            <span>10 · Extremely likely</span>
          </div>
        </AField>

        <AField label="What would make you upgrade from Solo to the Firm tier (or what's stopping you)?">
          <ATextArea value={firmUpgrade} onChange={setFirmUpgrade} rows={3} />
        </AField>

        <AField label="Anything else? (optional)">
          <ATextArea value={other} onChange={setOther} rows={3} />
        </AField>

        <div>
          <button type="submit" disabled={saving} className="att-btn-primary">
            {saving ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--att-text)",
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

function ATextArea({
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
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 2,
        border: "1px solid var(--att-border)",
        background: "var(--pp-card)",
        color: "var(--att-text)",
        fontSize: 13,
        fontFamily: "inherit",
        resize: "vertical",
        outline: "none",
      }}
    />
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 2,
  border: "1px solid var(--att-border)",
  background: "var(--pp-card)",
  color: "var(--att-text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
}; // touch
