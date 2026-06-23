import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Heart } from "lucide-react";
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

  useEffect(() => {
    peek({ data: { token } }).then(setPeeked).catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invite?.survivor_email && !email) {
      setEmail(peeked.invite.survivor_email);
    }
  }, [peeked, email]);

  const submit = async (e: React.FormEvent) => {
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
      await accept({ data: { token } });
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
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
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
            {busy ? "Connecting…" : user ? "Accept invite" : mode === "signup" ? "Create account & connect" : "Sign in & connect"}
          </button>
          <div style={{ fontSize: 11, color: "#667085", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={11} /> Encrypted. You can revoke access at any time from Settings.
          </div>
        </form>
      )}
    </Shell>
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