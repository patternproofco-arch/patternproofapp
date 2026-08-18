import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { acceptTeamInvite, peekTeamInvite } from "@/lib/workspaces.functions";

export const Route = createFileRoute("/team-invite/$token")({
  component: TeamInvitePage,
  head: () => ({
    meta: [
      { title: "PatternProof — Join your team workspace" },
      { name: "description", content: "Accept an invitation to join your firm or organization workspace on PatternProof." },
      { property: "og:title", content: "PatternProof — Join your team workspace" },
      { property: "og:description", content: "Accept an invitation to join your firm or organization workspace on PatternProof." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Peek = Awaited<ReturnType<typeof peekTeamInvite>>;

function TeamInvitePage() {
  const { token } = useParams({ from: "/team-invite/$token" });
  const peek = useServerFn(peekTeamInvite);
  const accept = useServerFn(acceptTeamInvite);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<Peek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    peek({ data: { token } }).then(setState).catch(() => setError("We couldn't open that invitation."));
  }, [peek, token]);
  useEffect(load, [load]);

  const onAccept = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await accept({ data: { token } });
      navigate({ to: r.kind === "firm" ? "/clients" : "/org-portal", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't add you to that workspace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, marginBottom: 10 }}>
        Join your team
      </h1>
      {state === null && !error && <p>Checking that invitation…</p>}
      {state?.status === "not-found" && <p>We couldn't find that invitation. Ask whoever sent it for a fresh link.</p>}
      {state?.status === "expired" && <p>That invitation has expired. Ask your teammate to send a new one.</p>}
      {state?.status === "revoked" && <p>That invitation was cancelled.</p>}
      {state?.status === "accepted" && <p>That invitation has already been used.</p>}
      {state?.status === "ok" && (
        <>
          <p style={{ lineHeight: 1.6 }}>
            You've been invited to join{" "}
            <strong>{state.invite.workspaceName || (state.invite.kind === "firm" ? "a firm" : "an organization")}</strong>{" "}
            on PatternProof as a {state.invite.role}. Sign in with <strong>{state.invite.email}</strong> to accept.
          </p>
          {loading ? (
            <p>One moment…</p>
          ) : !user ? (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate({ to: "/login" })}>
              Sign in to accept
            </button>
          ) : (
            <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={onAccept}>
              {busy ? "Joining…" : "Join the workspace"}
            </button>
          )}
        </>
      )}
      {error && <p style={{ marginTop: 14 }}>{error}</p>}
    </main>
  );
}
