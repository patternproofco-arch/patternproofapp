import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Scale, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { peekInvitation, acceptInvitation } from "@/lib/attorney-invitations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite/$token")({
  head: () => ({
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
        .then(() => { setAccepted(true); toast("Access granted."); navigate({ to: "/clients" }); })
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
      <div className="mb-6 text-center">
        <Scale size={28} className="mx-auto mb-2" style={{ color: "var(--accent)" }} />
        <div className="font-serif text-[24px] font-bold">You've been invited as counsel</div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          {peeked.invitation?.attorney_name ? `For ${peeked.invitation.attorney_name}` : "Read-only litigation access"}
        </p>
      </div>

      {user ? (
        <div className="card-pp text-center">
          <ShieldCheck size={28} className="mx-auto mb-2" style={{ color: "var(--safe)" }} />
          <p>{busy ? "Accepting access…" : "Linking your account…"}</p>
        </div>
      ) : (
        <div className="card-pp">
          <h2 className="font-serif text-[18px]">
            {mode === "signup" ? "Create your attorney account to continue" : "Sign in to accept"}
          </h2>
          <form onSubmit={auth} className="mt-4 space-y-3">
            <input className="input-pp" type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input-pp" type="password" required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "One moment…" : mode === "signup" ? "Create account & accept" : "Sign in & accept"}
            </button>
          </form>
          <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="mt-4 w-full text-center text-[13px]" style={{ color: "var(--accent)" }}>
            {mode === "signup" ? "I already have an account" : "Create a new account"}
          </button>
        </div>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
function Msg({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-pp">
      <h1 className="font-serif text-[22px]">{title}</h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>{body}</p>
    </div>
  );
}