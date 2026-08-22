import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { peekAdvocateInvitation, acceptAdvocateInvitation } from "@/lib/advocate.functions";
import { useAuth } from "@/lib/auth-context";
import { ADVOCATE_DISCLAIMER } from "@/components/AccessDisclaimer";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/advocate-invite/$token")({
  head: () => ({
    meta: [
      { title: "Advocate access invitation — PatternProof" },
      {
        name: "description",
        content: "Accept a read-only invitation to view a survivor's organized records.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Advocate access invitation — PatternProof" },
      {
        property: "og:description",
        content: "Accept a read-only invitation to view a survivor's organized records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvocateInvite,
});

type Peek = Awaited<ReturnType<typeof peekAdvocateInvitation>>;

function AdvocateInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const peek = useServerFn(peekAdvocateInvitation);
  const accept = useServerFn(acceptAdvocateInvitation);
  const [state, setState] = useState<Peek | null>(null);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    peek({ data: { token } })
      .then(setState)
      .catch(() => setState({ status: "not-found" }));
  }, [peek, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state?.status === "ok" && state.invitation) {
      setFullName((v) => v || state.invitation.advocate_name || "");
      setOrgName((v) => v || state.invitation.org_name || "");
    }
  }, [state]);

  const onAccept = async () => {
    setBusy(true);
    try {
      const r = await accept({
        data: { token, full_name: fullName || undefined, org_name: orgName || undefined },
      });
      toast("Access confirmed.");
      navigate({
        to: "/advocate-cases/$clientId",
        params: { clientId: r.clientId },
        replace: true,
      });
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "We couldn't open that invitation. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const wrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--background)",
    color: "var(--foreground)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 20px",
  };

  const card = (children: React.ReactNode) => (
    <div data-persona="org" style={wrap}>
      <PublicQuickExit />
      <div className="card-pp" style={{ maxWidth: 620, width: "100%", padding: 28 }}>
        {children}
      </div>
    </div>
  );

  if (!state) return card(<p style={{ fontSize: 14 }}>Opening this invitation…</p>);

  if (state.status !== "ok") {
    const msg =
      state.status === "not-found"
        ? "We couldn't find this invitation."
        : state.status === "expired"
          ? "This invitation has expired."
          : state.status === "revoked"
            ? "This invitation was withdrawn."
            : "This invitation has already been used.";
    return card(
      <>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{msg}</h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
          Ask the person who sent it to share a new link when they're ready.
        </p>
      </>,
    );
  }

  const inv = state.invitation;

  return card(
    <>
      <p
        className="text-[12px]"
        style={{
          color: "var(--muted-foreground)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Advocate access
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 10px" }}>
        You've been invited to view a case, read-only
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
        This invitation was sent to{" "}
        <strong style={{ color: "var(--foreground)" }}>{inv.advocate_email}</strong>
        {inv.case_label ? (
          <>
            {" "}
            for <strong style={{ color: "var(--foreground)" }}>{inv.case_label}</strong>
          </>
        ) : null}
        . You'll be able to read what was shared with you. You cannot edit, delete, or download the
        original files.
      </p>
      {inv.personal_note && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            marginTop: 12,
            padding: 12,
            background: "var(--input)",
            borderRadius: 18,
          }}
        >
          "{inv.personal_note}"
        </p>
      )}

      <ul style={{ fontSize: 13.5, lineHeight: 1.8, marginTop: 14, paddingLeft: 18 }}>
        <li>{inv.include_all_incidents ? "Journal entries" : "Selected journal entries"}</li>
        <li>{inv.include_all_evidence ? "Evidence list" : "Selected evidence"}</li>
        <li>{inv.include_patterns ? "Pattern grouping" : "Pattern grouping not shared"}</li>
      </ul>

      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <label style={{ fontSize: 12.5 }}>
          Your name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-pp"
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 12.5 }}>
          Organization
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="input-pp"
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
      </div>

      <p
        style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 16, color: "var(--muted-foreground)" }}
      >
        {ADVOCATE_DISCLAIMER}
      </p>

      {loading ? null : user ? (
        <button onClick={onAccept} disabled={busy} className="btn-pp" style={{ marginTop: 16 }}>
          {busy ? "Confirming…" : "Accept read-only access"}
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13.5, marginBottom: 8 }}>
            Sign in with {inv.advocate_email} to accept. You'll come back here afterwards.
          </p>
          <button
            onClick={() =>
              navigate({ to: "/signin", search: { redirect: `/advocate-invite/${token}` } })
            }
            className="btn-pp"
          >
            Sign in to continue
          </button>
        </div>
      )}
    </>,
  );
}
