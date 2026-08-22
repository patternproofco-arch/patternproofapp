import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Scale, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  peekCollaboratorInvite,
  acceptCollaboratorInvite,
} from "@/lib/attorney-collaborators.functions";
import attorneyCss from "@/styles/attorney.css?url";

export const Route = createFileRoute("/collaborator-invite/$token")({
  head: () => ({
    links: [{ rel: "stylesheet", href: attorneyCss }],
    meta: [
      { title: "Case collaborator invite — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CollaboratorInvitePage,
});

type Peek = Awaited<ReturnType<typeof peekCollaboratorInvite>>;

function CollaboratorInvitePage() {
  const { token } = useParams({ from: "/collaborator-invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekCollaboratorInvite);
  const accept = useServerFn(acceptCollaboratorInvite);

  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confidentialityOk, setConfidentialityOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    peek({ data: { token } })
      .then(setPeeked)
      .catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invite?.collaborator_email && !email) {
      setEmail(peeked.invite.collaborator_email);
      if (peeked.invite.collaborator_name) setFullName(peeked.invite.collaborator_name);
    }
  }, [peeked, email]);

  useEffect(() => {
    if (!loading && user && peeked?.status === "ok" && !done) {
      setBusy(true);
      accept({ data: { token } })
        .then(() => {
          setDone(true);
          toast("Case access granted.");
          setTimeout(() => navigate({ to: "/clients", replace: true }), 1200);
        })
        .catch((e) => toast(e instanceof Error ? e.message : "Couldn't accept invite."))
        .finally(() => setBusy(false));
    }
  }, [loading, user, peeked, done, accept, token, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!peeked) return <Frame><p>Opening invitation…</p></Frame>;
  if (peeked.status === "not-found") return <Frame><Msg title="Invite not found" body="This link is invalid." /></Frame>;
  if (peeked.status === "revoked") return <Frame><Msg title="Invite revoked" body="The owning attorney has cancelled this invite." /></Frame>;
  if (peeked.status === "active") return <Frame><Msg title="Already accepted" body="This invite has already been used." /></Frame>;

  const inv = peeked.invite!;
  const attorneyDisplay = inv.attorney_name
    ? `${inv.attorney_name}${inv.firm_name ? ` · ${inv.firm_name}` : ""}`
    : "An attorney on PatternProof";

  return (
    <Frame>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div className="att-eyebrow">PatternProof · Case collaborator</div>
        <h1 style={{ fontSize: 30, marginTop: 8, marginBottom: 6, fontFamily: "var(--font-serif)" }}>
          {attorneyDisplay} invited you to collaborate
        </h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 13 }}>
          Role on this case: <strong style={{ textTransform: "capitalize" }}>{inv.role}</strong>. Read-only case access plus secure messaging. Private attorney notes stay with the lead attorney.
        </p>
      </div>

      {user || done ? (
        <div className="att-card" style={{ textAlign: "center" }}>
          <ShieldCheck size={28} style={{ color: "var(--att-green)", margin: "0 auto 8px" }} />
          <p style={{ fontSize: 14, color: "var(--att-text-2)" }}>
            {done ? "You're in. Opening your case list…" : busy ? "Granting case access…" : "Linking your account…"}
          </p>
        </div>
      ) : (
        <div className="att-card">
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>
            {mode === "signup" ? "Create your collaborator account" : "Sign in to accept"}
          </h2>
          <p style={{ fontSize: 12, color: "var(--att-text-2)", marginBottom: 16 }}>
            Use your own login — distinct from the lead attorney. Case opens, downloads, and exports are recorded for provenance & integrity.
          </p>
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            {mode === "signup" && (
              <div>
                <label className="att-eyebrow">Full name</label>
                <input className="att-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginTop: 4 }} />
              </div>
            )}
            <div>
              <label className="att-eyebrow">Work email</label>
              <input className="att-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <div>
              <label className="att-eyebrow">Password</label>
              <input className="att-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 4 }} />
            </div>
            <label style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--att-text-2)", lineHeight: 1.5, alignItems: "flex-start", marginTop: 4 }}>
              <input type="checkbox" checked={confidentialityOk} onChange={(e) => setConfidentialityOk(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I acknowledge this case file is confidential and will only be accessed for the purpose of supporting this representation.</span>
            </label>
            <button className="att-btn-primary" disabled={busy || !confidentialityOk} style={{ width: "100%", marginTop: 4 }}>
              <Lock size={13} />
              {busy ? "One moment…" : mode === "signup" ? "Create account & accept" : "Sign in & accept"}
            </button>
          </form>
          <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="att-btn-ghost" style={{ width: "100%", marginTop: 12, fontSize: 12 }}>
            {mode === "signup" ? "I already have an account" : "Create a new account"}
          </button>
        </div>
      )}
      <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--att-muted)" }}>
        <Scale size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
        Encrypted in transit · attorney.pattern-proof.tech
      </p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="att-root" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}
function Msg({ title, body }: { title: string; body: string }) {
  return (
    <div className="att-card">
      <h1 style={{ fontSize: 22 }}>{title}</h1>
      <p style={{ marginTop: 8, fontSize: 13, color: "var(--att-text-2)" }}>{body}</p>
    </div>
  );
}