import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { acceptMatterInvitation, peekMatterInvitation } from "@/lib/matters.functions";
import { useAuth } from "@/lib/auth-context";
import { folio } from "@/components/pp/folio";

export const Route = createFileRoute("/matter-invite/$token")({
  head: () => ({
    meta: [
      { title: "Matter invitation — PatternProof" },
      {
        name: "description",
        content: "Accept an attorney's invitation to work on one matter in PatternProof.",
      },
      { property: "og:title", content: "Matter invitation — PatternProof" },
      {
        property: "og:description",
        content: "Accept an attorney's invitation to work on one matter in PatternProof.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MatterInvitePage,
});

function MatterInvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const peek = useServerFn(peekMatterInvitation);
  const accept = useServerFn(acceptMatterInvitation);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof peekMatterInvitation>> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/signin", search: { redirect: `/matter-invite/${token}` } as never });
      return;
    }
    peek({ data: { token } })
      .then(setInfo)
      .catch(() => setMsg("We couldn't look up this invitation."));
  }, [loading, user, peek, token, navigate]);

  return (
    <div style={folio.page}>
      <div style={folio.eyebrow}>Invitation</div>
      <h1 style={folio.h1}>{info?.matter?.matter_name ?? "A matter has been shared with you"}</h1>
      <p style={folio.lede}>
        An attorney has invited you to work alongside them on this one matter. You'll see only what
        this matter holds — nothing else in their practice.
      </p>

      {msg && <p style={{ fontSize: 14 }}>{msg}</p>}

      {info && !info.invitation && (
        <p style={{ fontSize: 14 }}>This invitation link isn't valid any more.</p>
      )}

      {info?.invitation?.status === "pending" && (
        <button
          type="button"
          style={folio.btn}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await accept({ data: { token } });
              navigate({ to: "/advocate-matters" });
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "We couldn't accept that invitation.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Accepting…" : "Accept invitation"}
        </button>
      )}

      {info?.invitation && info.invitation.status !== "pending" && (
        <p style={{ fontSize: 14 }}>
          This invitation is {info.invitation.status}. Ask the attorney to send a new one.
        </p>
      )}
    </div>
  );
}
