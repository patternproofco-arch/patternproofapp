import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  completeAttorneyOnboarding,
  getAttorneyProfile,
} from "@/lib/attorney-portal.functions";

export const Route = createFileRoute("/_attorney/setup")({
  component: OnboardingPage,
});

type RoleKey = "solo" | "firm" | "paralegal" | "advocate";
const ROLES: { key: RoleKey; label: string; hint: string }[] = [
  { key: "solo", label: "Solo attorney", hint: "Practicing on your own" },
  { key: "firm", label: "Firm attorney", hint: "Part of a multi-attorney firm" },
  { key: "paralegal", label: "Paralegal", hint: "Supporting attorneys on case prep" },
  { key: "advocate", label: "Victim advocate", hint: "Court advocate or DV organization" },
];

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const getProfile = useServerFn(getAttorneyProfile);
  const complete = useServerFn(completeAttorneyOnboarding);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [barNumber, setBarNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [role, setRole] = useState<RoleKey>("solo");
  const [confidentiality, setConfidentiality] = useState(false);

  useEffect(() => {
    getProfile()
      .then((r) => {
        const p = r.profile;
        if (p?.onboarded) {
          navigate({ to: "/subscribe", replace: true });
          return;
        }
        if (p) {
          setFullName(p.full_name ?? "");
          setEmail(p.email ?? user?.email ?? "");
          setFirmName(p.firm_name ?? "");
          setBarNumber(p.bar_number ?? "");
          setJurisdiction(p.jurisdiction ?? "");
          if (p.role && ["solo", "firm", "paralegal", "advocate"].includes(p.role)) {
            setRole(p.role as RoleKey);
          }
        } else if (user?.email) {
          setEmail(user.email);
        }
      })
      .finally(() => setLoading(false));
  }, [getProfile, navigate, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confidentiality) {
      toast("Please confirm the confidentiality acknowledgement.");
      return;
    }
    setSaving(true);
    try {
      await complete({
        data: {
          full_name: fullName.trim(),
          email: email.trim(),
          firm_name: firmName.trim() || null,
          bar_number: barNumber.trim() || null,
          jurisdiction: jurisdiction.trim() || null,
          role,
          confidentiality_accepted: true,
        },
      });
      toast("Profile saved. Choose your plan next.");
      navigate({ to: "/subscribe", replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="att-card">Loading…</div>;

  return (
    <div style={{ maxWidth: 760, margin: "32px auto" }}>
      <div className="att-eyebrow">Attorney Portal · Onboarding</div>
      <h1
        style={{
          fontSize: 36,
          marginTop: 6,
          marginBottom: 8,
          fontFamily: '"Instrument Serif", serif',
        }}
      >
        Set up your attorney profile.
      </h1>
      <p style={{ color: "var(--att-text-2)", fontSize: 15, marginBottom: 24 }}>
        A few details before we open your client case files. Everything here stays on your
        attorney profile — survivors only see your name and firm.
      </p>

      <form onSubmit={onSubmit} className="att-card" style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Full name *">
            <input
              className="att-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Email *">
            <input
              className="att-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </Field>
          <Field label="Firm / organization">
            <input
              className="att-input"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              maxLength={200}
              placeholder="Optional"
            />
          </Field>
          <Field label="Bar number">
            <input
              className="att-input"
              value={barNumber}
              onChange={(e) => setBarNumber(e.target.value)}
              maxLength={60}
              placeholder="Optional"
            />
          </Field>
          <Field label="Jurisdiction">
            <input
              className="att-input"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              maxLength={120}
              placeholder="e.g. NJ, NY, Family Court"
            />
          </Field>
        </div>

        <div>
          <div className="att-eyebrow" style={{ marginBottom: 8 }}>
            Your role
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRole(r.key)}
                  className="att-card att-hover"
                  style={{
                    padding: 14,
                    cursor: "pointer",
                    textAlign: "left",
                    border: active
                      ? "2px solid var(--att-navy)"
                      : "1px solid var(--att-border)",
                    background: active ? "#F8FAFC" : "var(--att-surface)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 2 }}>
                    {r.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: 14,
            background: "#F8FAFC",
            borderRadius: 8,
            border: "1px solid var(--att-border)",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <input
            type="checkbox"
            checked={confidentiality}
            onChange={(e) => setConfidentiality(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <ShieldCheck
              size={14}
              style={{
                color: "var(--att-green)",
                verticalAlign: "-2px",
                marginRight: 4,
              }}
            />
            I acknowledge that survivor case files are confidential and protected. I will
            access only the case files I am authorized to view, treat all materials as
            privileged, and follow my jurisdiction's professional-responsibility rules.
          </span>
        </label>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--att-text-2)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Lock size={12} /> Encrypted · chain of custody logged
          </div>
          <button type="submit" disabled={saving} className="att-btn-primary">
            {saving ? "Saving…" : (
              <>
                Continue to pricing <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.08,
          textTransform: "uppercase",
          color: "var(--att-slate)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}