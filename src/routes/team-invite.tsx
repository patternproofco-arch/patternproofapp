import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { useAuth } from "@/lib/auth-context";
import { acceptFirmMemberInvitation } from "@/lib/firm-grants.functions";
import { acceptOrgMemberInvitation } from "@/lib/org-portal.functions";

export const Route = createFileRoute("/team-invite")({
  head: () => ({
    meta: [
      { title: "Accept team invitation — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: TeamInvitePage,
});

type StoredInvite = { kind: "firm" | "org"; token: string };

function readInvite(): StoredInvite | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const fromHash = params.get("firm")
    ? { kind: "firm" as const, token: params.get("firm")! }
    : params.get("org")
      ? { kind: "org" as const, token: params.get("org")! }
      : null;
  if (fromHash) {
    sessionStorage.setItem("patternproof-team-invite", JSON.stringify(fromHash));
    window.history.replaceState(null, "", "/team-invite");
    return fromHash;
  }
  try {
    return JSON.parse(
      sessionStorage.getItem("patternproof-team-invite") || "null",
    ) as StoredInvite | null;
  } catch {
    return null;
  }
}

function TeamInvitePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const acceptFirm = useServerFn(acceptFirmMemberInvitation);
  const acceptOrg = useServerFn(acceptOrgMemberInvitation);
  const [invite] = useState(readInvite);
  const [status, setStatus] = useState("Checking invitation…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || !invite) return;
    let cancelled = false;
    setStatus("Accepting secure invitation…");
    const action =
      invite.kind === "firm"
        ? acceptFirm({ data: { token: invite.token } })
        : acceptOrg({ data: { token: invite.token } });
    action
      .then(() => {
        if (cancelled) return;
        sessionStorage.removeItem("patternproof-team-invite");
        setStatus("Invitation accepted.");
        navigate({ to: invite.kind === "firm" ? "/clients" : "/org-portal", replace: true });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "This invitation could not be accepted.");
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, invite, acceptFirm, acceptOrg, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--pp-ground)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <PublicQuickExit />
      <main
        style={{
          maxWidth: 520,
          background: "var(--pp-card)",
          borderRadius: 22,
          padding: 28,
          boxShadow: "var(--pp-shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={26} />
          <strong>PatternProof</strong>
        </div>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={24} /> Team invitation
        </h1>
        {!invite ? (
          <p>This invitation link is missing or no longer available.</p>
        ) : !user && !loading ? (
          <>
            <p>
              Sign in with the verified email address that received this invitation. Use a separate
              professional account—not a survivor account.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="/signin?redirect=/team-invite" style={button}>
                Sign in
              </a>
              <a href="/signup?redirect=/team-invite" style={button}>
                Create account
              </a>
            </div>
          </>
        ) : error ? (
          <>
            <p style={{ color: "var(--destructive)" }}>{error}</p>
            <p>
              The invitation may be expired, already used, tied to another email, or require a
              separate professional login.
            </p>
          </>
        ) : (
          <p>{status}</p>
        )}
      </main>
    </div>
  );
}

const button: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 10,
  background: "#022063",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
};
