import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Scale, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { peekInvitation, acceptInvitation } from "@/lib/attorney-invitations.functions";
import {
  getMyAttorneyApplication,
  type AttorneyApplication,
} from "@/lib/founder-operations.functions";
import { InviteApprovalStep } from "@/components/attorney/InviteApprovalStep";
import { toast } from "sonner";
import attorneyCss from "@/styles/attorney.css?url";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";
import {
  clearInviteDraft,
  isWrongInviteAccount,
  loadInviteDraft,
  saveInviteDraft,
} from "@/lib/invite-draft";

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
  const getApplication = useServerFn(getMyAttorneyApplication);
  const [application, setApplication] = useState<AttorneyApplication | null>(null);
  const [appChecked, setAppChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recheck, setRecheck] = useState(0);
  // Guards against double submits: a ref flips instantly, state does not.
  const acceptInFlight = useRef(false);
  const authInFlight = useRef(false);
  const invitedEmail = peeked?.status === "ok" ? (peeked.invitation?.attorney_email ?? null) : null;
  const wrongAccount = !!user && isWrongInviteAccount(user.email, invitedEmail);

  // Keep what the attorney typed at signup so the approval step is prefilled
  // after they confirm their email. The confirmation link usually opens in a
  // NEW tab, so this lives in localStorage with a one day expiry (name and bar
  // number only, never the password) and is cleared once it has been used.
  useEffect(() => {
    try {
      const d = loadInviteDraft(window.localStorage, token);
      if (!d) return;
      if (d.fullName) setFullName((cur) => cur || d.fullName);
      if (d.barNumber) setBarNumber((cur) => cur || d.barNumber);
    } catch {
      /* storage blocked; the form still works */
    }
  }, [token]);

  useEffect(() => {
    peek({ data: { token } })
      .then(setPeeked)
      .catch(() => setPeeked({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    if (peeked?.status === "ok" && peeked.invitation?.attorney_email && !email) {
      setEmail(peeked.invitation.attorney_email);
    }
  }, [peeked, email]);

  // Signed in: check approval first. Only an approved attorney attempts
  // acceptance (the server enforces this too); everyone else sees the
  // approval step instead of a stuck "Linking…" screen.
  useEffect(() => {
    if (loading || !user || peeked?.status !== "ok" || accepted || wrongAccount) return;
    let cancelled = false;
    setBusy(true);
    setFailed(false);
    getApplication()
      .then(async ({ application: row }) => {
        if (cancelled) return;
        setApplication(row);
        setAppChecked(true);
        if (row?.status !== "approved") return;
        // One accept at a time, even if this effect re-runs while it is in flight.
        if (acceptInFlight.current) return;
        acceptInFlight.current = true;
        try {
          await accept({ data: { token } });
        } catch (err) {
          acceptInFlight.current = false;
          throw err;
        }
        try {
          clearInviteDraft(window.localStorage, token);
        } catch {
          /* nothing to clear */
        }
        // The accept already happened on the server, so show the result even if
        // this effect was replaced while the request was in flight.
        setAccepted(true);
        toast("Client invitation accepted.");
        // Stay on the invitation confirmation; never send a newly approved attorney to a paywall.
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, peeked, accepted, wrongAccount, accept, getApplication, token, recheck]);

  const auth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authInFlight.current) return;
    authInFlight.current = true;
    setBusy(true);
    try {
      if (mode === "signup") {
        saveInviteDraft(window.localStorage, token, { fullName, barNumber });
        const { error } = await supabase.auth.signUp({
          email,
          password,
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
      authInFlight.current = false;
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
  };

  if (!peeked)
    return (
      <Frame>
        <p>Opening invitation…</p>
      </Frame>
    );
  if (accepted)
    return (
      <Frame>
        <Msg
          live="status"
          title="Client invitation accepted"
          body="Your access has been granted. You can continue to your attorney workspace from your account navigation."
        />
      </Frame>
    );
  if (peeked.status === "not-found")
    return (
      <Frame>
        <Msg title="Invitation not found" body="This link is invalid." />
      </Frame>
    );
  if (peeked.status === "revoked")
    return (
      <Frame>
        <Msg title="Invitation revoked" body="The client has cancelled this invitation." />
      </Frame>
    );
  if (peeked.status === "expired")
    return (
      <Frame>
        <Msg title="Invitation expired" body="Ask your client to send a new link." />
      </Frame>
    );
  if (peeked.status === "accepted")
    return (
      <Frame>
        <Msg title="Already accepted" body="This invitation has already been accepted." />
      </Frame>
    );

  return (
    <Frame>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <BrandMark size={40} variant="attorney" />
        </div>
        <div className="att-eyebrow">PatternProof · Attorney Portal</div>
        <h1 style={{ fontSize: 32, marginTop: 8, marginBottom: 6 }}>Confidential case access</h1>
        <p style={{ color: "var(--att-text-2)", fontSize: 13 }}>
          {peeked.invitation?.attorney_name
            ? `Prepared for ${peeked.invitation.attorney_name}.`
            : "Read-only litigation access."}
          {peeked.invitation?.attorney_email ? ` · ${peeked.invitation.attorney_email}` : ""}
        </p>
      </div>

      {wrongAccount ? (
        <div className="att-card" role="alert">
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>This invitation is for a different account</h2>
          <p style={{ fontSize: 13, color: "var(--att-text-2)", marginBottom: 14 }}>
            You are signed in as {user?.email}. This invitation was prepared for {invitedEmail}.
            Sign out, then sign in or create an account with that address to continue.
          </p>
          <button type="button" className="att-btn-primary" style={{ width: "100%" }} onClick={switchAccount}>
            Sign out and switch account
          </button>
        </div>
      ) : user && failed ? (
        <div className="att-card" role="alert">
          <p>We could not complete the approval or invitation check. Please try again.</p>
          <button type="button" className="att-btn-primary" onClick={() => setRecheck((n) => n + 1)}>Retry</button>
        </div>
      ) : user && appChecked && application?.status !== "approved" ? (
        <InviteApprovalStep
          application={application}
          draft={{ fullName, barNumber }}
          onSubmitted={() => {
            try {
              clearInviteDraft(window.localStorage, token);
            } catch {
              /* nothing to clear */
            }
            setRecheck((n) => n + 1);
          }}
        />
      ) : user ? (
        <div className="att-card" role="status" aria-live="polite" style={{ textAlign: "center" }}>
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
            Case opens, downloads, and exports are recorded for provenance & integrity. Your bar
            number is recorded with this case file.
          </p>
          <form onSubmit={auth} style={{ display: "grid", gap: 12 }}>
            {mode === "signup" && (
              <>
                <div>
                  <label className="att-eyebrow" htmlFor="accept-invite-full-name">Full name</label>
                  <input id="accept-invite-full-name"
                    className="att-input"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div>
                  <label className="att-eyebrow" htmlFor="accept-invite-bar-number">Bar number</label>
                  <input id="accept-invite-bar-number"
                    className="att-input"
                    required
                    value={barNumber}
                    onChange={(e) => setBarNumber(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </>
            )}
            <div>
              <label className="att-eyebrow" htmlFor="accept-invite-work-email">Work email</label>
              <input autoComplete="email" id="accept-invite-work-email"
                className="att-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <label className="att-eyebrow" htmlFor="accept-invite-password">Password</label>
              <input autoComplete={mode === "signup" ? "new-password" : "current-password"} id="accept-invite-password"
                className="att-input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <label
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12,
                color: "var(--att-text-2)",
                lineHeight: 1.5,
                alignItems: "flex-start",
                marginTop: 4,
              }}
            >
              <input
                type="checkbox"
                checked={confidentialityOk}
                onChange={(e) => setConfidentialityOk(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I acknowledge this case file is confidential, protected by attorney-client privilege
                where applicable, and will only be accessed for the purpose of representing this
                client.
              </span>
            </label>
            <button
              className="att-btn-primary"
              disabled={busy || !confidentialityOk}
              style={{ width: "100%", marginTop: 4 }}
            >
              <Lock size={13} />
              {busy
                ? "One moment…"
                : mode === "signup"
                  ? "Create account & access case file"
                  : "Sign in & access case file"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="att-btn-ghost"
            style={{ width: "100%", marginTop: 12, fontSize: 12 }}
          >
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
    <div
      className="att-root"
      data-pp-paper=""
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <PublicQuickExit />
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}
function Msg({ title, body, live }: { title: string; body: string; live?: "status" | "alert" }) {
  return (
    <div className="att-card" role={live} aria-live={live === "status" ? "polite" : undefined}>
      <h1 style={{ fontSize: 22 }}>{title}</h1>
      <p style={{ marginTop: 8, fontSize: 13, color: "var(--att-text-2)" }}>{body}</p>
    </div>
  );
}
