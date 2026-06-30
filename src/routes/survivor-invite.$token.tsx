import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Heart, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  peekSurvivorInvite,
  acceptSurvivorInvite,
} from "@/lib/attorney-survivor-invites.functions";

export const Route = createFileRoute("/survivor-invite/$token")({
  head: () => ({
    meta: [
      { title: "An attorney is inviting you — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SurvivorInvitePage,
});

type Peek = Awaited<ReturnType<typeof peekSurvivorInvite>>;

function SurvivorInvitePage() {
  const { token } = useParams({ from: "/survivor-invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekSurvivorInvite);
  const accept = useServerFn(acceptSurvivorInvite);

  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"auth" | "scope">("auth");
  const [scopeChoice, setScopeChoice] = useState<"all" | "custom">("all");
  const [shareIncidents, setShareIncidents] = useState(true);
  const [shareEvidence, setShareEvidence] = useState(true);
  const [sharePatterns, setSharePatterns] = useState(true);

  // If the user is already signed in when they land here, skip straight to scope.
  useEffect(() => {
    if (user && peeked?.status === "ok" && step === "auth") setStep("scope");
  }, [user, peeked, step]);

  useEffect(() => {
    peek({ data: { token } }).then(setPeeked).catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invite?.survivor_email && !email) {
      setEmail(peeked.invite.survivor_email);
    }
  }, [peeked, email]);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!user) {
        if (mode === "signup") {
          const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: window.location.href },
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw error;
        }
      }
      setStep("scope");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  const confirmScope = async () => {
    setBusy(true);
    try {
      const scope = scopeChoice === "all"
        ? { include_all_incidents: true, include_all_evidence: true, include_patterns: true }
        : { include_all_incidents: shareIncidents, include_all_evidence: shareEvidence, include_patterns: sharePatterns };
      await accept({ data: { token, scope } });
      setDone(true);
      toast("Connected. Your attorney now has access to your case.");
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't accept the invite.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || peeked === null) {
    return <Shell><p style={{ color: "var(--pp-muted)" }}>Loading invite…</p></Shell>;
  }

  if (peeked.status !== "ok") {
    const labels: Record<string, string> = {
      "not-found": "We couldn't find this invite.",
      expired: "This invite has expired. Ask your attorney to resend it.",
      revoked: "This invite has been revoked.",
      accepted: "This invite has already been used.",
    };
    return (
      <Shell>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Invite unavailable</h1>
        <p style={{ color: "var(--pp-muted)" }}>{labels[peeked.status] ?? "This invite is no longer valid."}</p>
      </Shell>
    );
  }

  const inv = peeked.invite!;
  const attorneyDisplay = inv.attorney_name
    ? `${inv.attorney_name}${inv.firm_name ? ` · ${inv.firm_name}` : ""}`
    : "Your attorney";

  return (
    <Shell>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#2F8D85", marginBottom: 12 }}>
        <Heart size={12} /> PATTERNPROOF · Survivor invite
      </div>
      <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 32, marginBottom: 8 }}>
        {attorneyDisplay} invited you to share your case.
      </h1>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 18 }}>
        Sign in or create your PatternProof account to connect. You stay in control of what they can see.
      </p>

      {inv.personal_note && (
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderLeft: "3px solid #2F8D85", borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {inv.personal_note}
        </div>
      )}

      {done ? (
        <div style={{ padding: 16, background: "#D1FAE5", borderRadius: 8, color: "#065F46", fontSize: 14 }}>
          <ShieldCheck size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Connected. Taking you to your dashboard…
        </div>
      ) : step === "auth" ? (
        <form onSubmit={submitAuth} style={{ display: "grid", gap: 12 }}>
          {!user && (
            <div style={{ display: "flex", gap: 4, fontSize: 12 }}>
              <button type="button" onClick={() => setMode("signup")} style={{ padding: "6px 12px", borderRadius: 6, border: mode === "signup" ? "1px solid #2F8D85" : "1px solid #E2E8F0", background: mode === "signup" ? "#EAF7EF" : "#fff", cursor: "pointer" }}>Create account</button>
              <button type="button" onClick={() => setMode("login")} style={{ padding: "6px 12px", borderRadius: 6, border: mode === "login" ? "1px solid #2F8D85" : "1px solid #E2E8F0", background: mode === "login" ? "#EAF7EF" : "#fff", cursor: "pointer" }}>I already have an account</button>
            </div>
          )}
          {!user && (
            <>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "#667085" }}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.08, textTransform: "uppercase", color: "#667085" }}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "12px 18px",
              background: "#2F8D85",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Connecting…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </button>
          <div style={{ fontSize: 11, color: "#667085", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={11} /> Encrypted. You can revoke access at any time from Settings.
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, margin: 0 }}>What would you like to share?</h2>
            <p style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
              Most survivors share everything with their attorney so nothing important is missed. You can change this any time from Settings.
            </p>
          </div>

          <label
            onClick={() => setScopeChoice("all")}
            style={{
              display: "grid", gap: 4, padding: 14, borderRadius: 12, cursor: "pointer",
              border: scopeChoice === "all" ? "2px solid #2F8D85" : "1px solid #E2E8F0",
              background: scopeChoice === "all" ? "#EAF7EF" : "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="radio" name="scope" checked={scopeChoice === "all"} onChange={() => setScopeChoice("all")} />
              <strong style={{ fontSize: 14 }}>Share everything with {attorneyDisplay}</strong>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#065F46", background: "#D1FAE5", padding: "2px 6px", borderRadius: 4 }}>RECOMMENDED</span>
            </div>
            <p style={{ fontSize: 12, color: "#475569", marginLeft: 24 }}>
              All incidents, evidence, and pattern analysis. The fullest picture for your case.
            </p>
          </label>

          <label
            onClick={() => setScopeChoice("custom")}
            style={{
              display: "grid", gap: 4, padding: 14, borderRadius: 12, cursor: "pointer",
              border: scopeChoice === "custom" ? "2px solid #2F8D85" : "1px solid #E2E8F0",
              background: scopeChoice === "custom" ? "#EAF7EF" : "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="radio" name="scope" checked={scopeChoice === "custom"} onChange={() => setScopeChoice("custom")} />
              <SlidersHorizontal size={14} />
              <strong style={{ fontSize: 14 }}>Choose what to share</strong>
            </div>
            <p style={{ fontSize: 12, color: "#475569", marginLeft: 24 }}>Pick categories below.</p>

            {scopeChoice === "custom" && (
              <div style={{ display: "grid", gap: 8, marginTop: 10, marginLeft: 24 }}>
                <Toggle checked={shareIncidents} onChange={setShareIncidents} label="All incidents" />
                <Toggle checked={shareEvidence} onChange={setShareEvidence} label="All evidence files" />
                <Toggle checked={sharePatterns} onChange={setSharePatterns} label="Pattern analysis" />
                <p style={{ fontSize: 11, color: "#667085" }}>
                  Per-item selection (specific incidents or files) is available in Settings → Sharing after you connect.
                </p>
              </div>
            )}
          </label>

          <button
            type="button"
            onClick={confirmScope}
            disabled={busy}
            style={{
              padding: "12px 18px", background: "#2F8D85", color: "#fff", border: 0, borderRadius: 8,
              fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> {busy ? "Connecting…" : "Connect with my attorney"}
          </button>
          <div style={{ fontSize: 11, color: "#667085", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={11} /> You can revoke or change scope any time from Settings.
          </div>
        </div>
      )}
    </Shell>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#fff",
  fontSize: 14,
  fontFamily: "inherit",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FBFEFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 520, width: "100%", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
        {children}
      </div>
    </div>
  );
}