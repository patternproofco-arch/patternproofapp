import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, CheckCircle2, Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import {
  peekAdvocateSurvivorInvite,
  acceptAdvocateSurvivorInvite,
  declineAdvocateSurvivorInvite,
} from "@/lib/advocate-survivor-invites.functions";

export const Route = createFileRoute("/advocate-survivor-invite/$token")({
  head: () => ({
    meta: [
      { title: "An advocate invited you — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content:
          "Review an advocate invite. Opening the link alone does not grant access — you must explicitly Accept.",
      },
    ],
  }),
  component: AdvocateSurvivorInvitePage,
});

type Peek = Awaited<ReturnType<typeof peekAdvocateSurvivorInvite>>;

function AdvocateSurvivorInvitePage() {
  const { token } = useParams({ from: "/advocate-survivor-invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekAdvocateSurvivorInvite);
  const accept = useServerFn(acceptAdvocateSurvivorInvite);
  const decline = useServerFn(declineAdvocateSurvivorInvite);

  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [step, setStep] = useState<"auth" | "consent">("auth");

  // Checklist must start unchecked — fail closed until survivor opts in.
  const [ackWho, setAckWho] = useState(false);
  const [ackScope, setAckScope] = useState(false);
  const [ackRevoke, setAckRevoke] = useState(false);
  const [shareIncidents, setShareIncidents] = useState(true);
  const [shareEvidence, setShareEvidence] = useState(true);
  const [sharePatterns, setSharePatterns] = useState(true);

  useEffect(() => {
    if (user && peeked?.status === "ok" && step === "auth") setStep("consent");
  }, [user, peeked, step]);

  useEffect(() => {
    peek({ data: { token } })
      .then(setPeeked)
      .catch(() => setPeeked({ status: "not-found" }));
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
          toast("Check your email to verify, then return here to Accept.");
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
        }
      }
      setStep("consent");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  const confirmAccept = async () => {
    if (!ackWho || !ackScope || !ackRevoke) {
      toast("Please confirm each checklist item before accepting.");
      return;
    }
    setBusy(true);
    try {
      await accept({
        data: {
          token,
          acknowledgements: { who: true, scope: true, revoke: true },
          scope: {
            include_all_incidents: shareIncidents,
            include_all_evidence: shareEvidence,
            include_patterns: sharePatterns,
            scope_incidents: [],
            scope_evidence: [],
          },
        },
      });
      setDone("accepted");
      toast("Shared. Your advocate can now view what you chose.");
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't accept the invite.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDecline = async () => {
    setBusy(true);
    try {
      await decline({ data: { token } });
      setDone("declined");
      toast("Invite declined. No access was granted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't decline the invite.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || peeked === null) {
    return (
      <Shell>
        <p style={{ color: "var(--pp-muted)" }}>Loading invite…</p>
      </Shell>
    );
  }

  if (peeked.status !== "ok") {
    const labels: Record<string, string> = {
      "not-found": "We couldn't find this invite.",
      expired: "This invite has expired. Ask your advocate to resend it.",
      revoked: "This invite has been revoked.",
      accepted: "This invite has already been used.",
      declined: "This invite was declined.",
    };
    return (
      <Shell>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Invite unavailable</h1>
        <p style={{ color: "var(--pp-muted)" }}>
          {labels[peeked.status] ?? "This invite is no longer valid."}
        </p>
        <p style={{ color: "var(--pp-muted)", fontSize: 13, marginTop: 10 }}>
          Opening an invite link alone never grants vault access.
        </p>
      </Shell>
    );
  }

  const inv = peeked.invite!;
  const advocateDisplay = inv.advocate_name
    ? `${inv.advocate_name}${inv.org_name ? ` · ${inv.org_name}` : ""}`
    : inv.org_name || "Your advocate";

  return (
    <Shell>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: "1px solid var(--pp-hairline)",
        }}
      >
        <BrandMark size={32} />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.12,
            textTransform: "uppercase",
            color: "var(--pp-muted)",
          }}
        >
          <Heart size={12} /> Advocate invite
        </div>
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 300,
          fontSize: 32,
          marginBottom: 8,
        }}
      >
        {advocateDisplay} invited you to share records.
      </h1>
      <p style={{ color: "var(--pp-muted)", fontSize: 14, marginBottom: 18 }}>
        Opening this link does <strong>not</strong> grant access. You stay in control: Accept only
        after the checklist below, choose what to share, and revoke anytime. This is not
        attorney–client privilege.
      </p>

      {inv.personal_note && (
        <div
          style={{
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-in-sm)",
            borderLeft: "3px solid var(--pp-accent-org, var(--pp-accent))",
            borderRadius: "var(--pp-r-lg)",
            padding: 14,
            marginBottom: 18,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {inv.personal_note}
        </div>
      )}

      {done === "accepted" ? (
        <div
          style={{
            padding: 16,
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-in-sm)",
            borderRadius: "var(--pp-r-lg)",
            borderLeft: "3px solid var(--pp-safe, var(--pp-accent))",
            color: "var(--pp-ink)",
            fontSize: 14,
          }}
        >
          <ShieldCheck size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Shared. Taking you to your dashboard…
        </div>
      ) : done === "declined" ? (
        <div
          style={{
            padding: 16,
            background: "var(--pp-ground)",
            boxShadow: "var(--pp-shadow-in-sm)",
            borderRadius: "var(--pp-r-lg)",
            fontSize: 14,
          }}
        >
          Declined. No access was granted to this advocate.
        </div>
      ) : step === "auth" ? (
        <form onSubmit={submitAuth} style={{ display: "grid", gap: 12 }}>
          {!user && (
            <div style={{ display: "flex", gap: 4, fontSize: 12 }}>
              <button type="button" onClick={() => setMode("signup")} style={pill(mode === "signup")}>
                Create account
              </button>
              <button type="button" onClick={() => setMode("login")} style={pill(mode === "login")}>
                I already have an account
              </button>
            </div>
          )}
          {!user && (
            <>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={labelEyebrow}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={labelEyebrow}>Password</span>
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
          <button type="submit" disabled={busy} style={primaryBtn(busy)}>
            {busy
              ? "Connecting…"
              : mode === "signup"
                ? "Create account & continue"
                : "Sign in & continue"}
          </button>
          <div style={{ fontSize: 11, color: "var(--pp-muted)", display: "inline-flex", gap: 6 }}>
            <Lock size={11} /> You must explicitly Accept on the next step before anything is shared.
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 300,
                fontSize: 22,
                margin: 0,
              }}
            >
              Accept only if you agree
            </h2>
            <p style={{ fontSize: 13, color: "var(--pp-muted)", marginTop: 6 }}>
              All boxes start unchecked. Finish onboarding first if you haven&apos;t — Accept will
              fail closed until then.
            </p>
          </div>

          <ChecklistItem
            checked={ackWho}
            onChange={setAckWho}
            label={`I understand ${advocateDisplay} will be able to view the records I choose to share (read-only).`}
          />
          <ChecklistItem
            checked={ackScope}
            onChange={setAckScope}
            label="I choose the scope below (incidents, evidence, pattern analysis). They only see what I enable."
          />
          <ChecklistItem
            checked={ackRevoke}
            onChange={setAckRevoke}
            label="I understand I can revoke later. Revoking ends new access; it does not undo past downloads made while access was active."
          />

          <div
            style={{
              padding: 14,
              borderRadius: "var(--pp-r-lg)",
              boxShadow: "var(--pp-shadow-in-sm)",
              background: "var(--pp-ground)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.06, textTransform: "uppercase", color: "var(--pp-muted)" }}>
              Scope
            </div>
            <Toggle checked={shareIncidents} onChange={setShareIncidents} label="Share incidents" />
            <Toggle checked={shareEvidence} onChange={setShareEvidence} label="Share evidence metadata" />
            <Toggle checked={sharePatterns} onChange={setSharePatterns} label="Share pattern analysis" />
          </div>

          <button
            type="button"
            onClick={confirmAccept}
            disabled={busy || !ackWho || !ackScope || !ackRevoke}
            style={primaryBtn(busy || !ackWho || !ackScope || !ackRevoke)}
          >
            <CheckCircle2 size={14} /> {busy ? "Sharing…" : "Accept & share"}
          </button>
          <button
            type="button"
            onClick={confirmDecline}
            disabled={busy}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "var(--pp-muted)",
              border: "none",
              borderRadius: "var(--pp-r-pill, 18px)",
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              textDecoration: "underline",
            }}
          >
            Decline — grant no access
          </button>
          <div style={{ fontSize: 11, color: "var(--pp-muted)", display: "inline-flex", gap: 6 }}>
            <Lock size={11} /> Authz is server-side grant status, not possession of this link.
          </div>
        </div>
      )}
    </Shell>
  );
}

function ChecklistItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 10,
        padding: 12,
        borderRadius: "var(--pp-r-lg)",
        boxShadow: checked ? "var(--pp-shadow-in-sm)" : "var(--pp-shadow-sm)",
        background: "var(--pp-ground)",
        fontSize: 13,
        lineHeight: 1.5,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2 }}
      />
      <span>{label}</span>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: "var(--pp-r-pill, 18px)",
    background: "var(--pp-ground)",
    boxShadow: active ? "var(--pp-shadow-in-sm)" : "var(--pp-shadow-sm)",
    color: active ? "var(--pp-accent)" : "var(--pp-ink)",
    fontWeight: active ? 700 : 400,
    border: "none",
    cursor: "pointer",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 18px",
    background: "var(--pp-accent-org, var(--pp-accent))",
    color: "var(--pp-accent-fg, #fff)",
    border: 0,
    borderRadius: "var(--pp-r-pill, 18px)",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
}

const labelEyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.08,
  textTransform: "uppercase",
  color: "var(--pp-muted)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 18,
  border: "none",
  boxShadow: "var(--pp-shadow-in-sm)",
  background: "var(--pp-ground)",
  fontSize: 14,
  fontFamily: "inherit",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-paper, #FAF8F4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <PublicQuickExit />
      <div
        style={{
          maxWidth: 680,
          width: "100%",
          background: "var(--pp-card)",
          borderRadius: "var(--pp-r-lg)",
          padding: 28,
          boxShadow: "var(--pp-shadow-sm)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
