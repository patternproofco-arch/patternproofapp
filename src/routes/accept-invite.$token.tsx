import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Scale, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { peekInvitation, acceptInvitation } from "@/lib/attorney-invitations.functions";
import { toast } from "sonner";
import attorneyCss from "@/styles/attorney.css?url";

export const Route = createFileRoute("/accept-invite/$token")({
  head: () => ({
    links: [{ rel: "stylesheet", href: attorneyCss }],
    meta: [
      { title: "Accept client invitation — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AcceptInvite,
});

type Peek = Awaited<ReturnType<typeof peekInvitation>>;

function AcceptInvite() {
  const { token } = useParams({ from: "/accept-invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekInvitation);
  const accept = useServerFn(acceptInvitation);

  const [peeked, setPeeked] = useState<Peek | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [confidentialityOk, setConfidentialityOk] = useState(false);
  const [fullName, setFullName] = useState("");
  const [barNumber, setBarNumber] = useState("");

  useEffect(() => {
    peek({ data: { token } }).then(setPeeked).catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invitation?.attorney_email && !email) {
      setEmail(peeked.invitation.attorney_email);
    }
  }, [peeked, email]);

  useEffect(() => {
    if (!loading && user && peeked?.status === "ok" && !accepted) {
      setBusy(true);
      accept({ data: { token } })
        .then(() => { setAccepted(true); toast("Access granted. One step left."); navigate({ to: "/subscribe" }); })
        .catch((e) => toast(e instanceof Error ? e.message : "Couldn't accept."))
        .finally(() => setBusy(false));
    }
  }, [loading, user, peeked, accepted, accept, token, navigate]);

  const auth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + `/accept-invite/${token}` },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!peeked) return <Frame><p>Opening invitation…</p></Frame>;
  if (peeked.status === "not-found") return <Frame><Msg title="Invitation not found" body="This link is invalid." /></Frame>;
  if (peeked.status === "revoked") return <Frame><Msg title="Invitation revoked" body="The client has cancelled this invitation." /></Frame>;
  if (peeked.status === "expired") return <Frame><Msg title="Invitation expired" body="Ask your client to send a new link." /></Frame>;
  if (peeked.status === "accepted") return <Frame><Msg title="Already accepted" body="This invitation has already been accepted." /></Frame>;

  return (
    <Frame>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div className="att-nav-brand-mark" style={{ width: 40, height: 40, margin: "0 auto 14px" }} />
        <div className="att-eyebrow">PatternProof · Attorney Portal</div>
        <h1 style={{ fontSize: 32, marginTop: 8, marginBottom: 6 }}>Confidential case access</h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 13 }}>
          {peeked.invitation?.attorney_name ? `Prepared for ${peeked.invitation.attorney_name}.` : "Read-only litigation access."}
          {peeked.invitation?.attorney_email ? ` · ${peeked.invitation.attorney_email}` : ""}
        </p>
      </div>

      {user ? (
        <div className="att-card" style={{ textAlign: "center" }}>
          <ShieldCheck size={28} style={{ color: "var(--att-green)", margin: "0 auto 8px" }} />
          <p style={{ fontSize: 14, color: "var(--att-text-2)" }}>
            {busy ? "Granting case file access…" : "Linking your account…"}
          </p>
        </div>
      ) : (
        <div className="att-card">
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>
            {mode === "signup" ? "Verify your credentials" : "Sign in to access this case"}
          </h2>
          <p style={{ fontSize: 12, color: "var(--att-text-2)", marginBottom: 16 }}>
            Case opens, downloads, and exports are recorded for provenance & integrity. Your bar number is recorded with this case file.
          </p>
          <form onSubmit={auth} style={{ display: "grid", gap: 12 }}>
            {mode === "signup" && (
              <>
                <div>
                  <label className="att-eyebrow">Full name</label>
                  <input className="att-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginTop: 4 }} />
                </div>
                <div>
                  <label className="att-eyebrow">Bar number</label>
                  <input className="att-input" required value={barNumber} onChange={(e) => setBarNumber(e.target.value)} style={{ marginTop: 4 }} />
                </div>
              </>
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
              <span>I acknowledge this case file is confidential, protected by attorney-client privilege where applicable, and will only be accessed for the purpose of representing this client.</span>
            </label>
            <button className="att-btn-primary" disabled={busy || !confidentialityOk} style={{ width: "100%", marginTop: 4 }}>
              <Lock size={13} />
              {busy ? "One moment…" : mode === "signup" ? "Create account & access case file" : "Sign in & access case file"}
            </button>
          </form>
          <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="att-btn-ghost" style={{ width: "100%", marginTop: 12, fontSize: 12 }}>
            {mode === "signup" ? "I already have an attorney account" : "Create a new account"}
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