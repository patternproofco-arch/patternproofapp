import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMatter,
  inviteAdvocateToMatter,
  revokeMatterAdvocate,
  revokeMatterInvitation,
  updateMatter,
} from "@/lib/matters.functions";
import { folio } from "@/components/pp/folio";

export const Route = createFileRoute("/_attorney/matters/$matterId")({
  head: () => ({
    meta: [
      { title: "Matter — PatternProof" },
      {
        name: "description",
        content: "One matter: its details, the client file attached to it, and assigned advocates.",
      },
      { property: "og:title", content: "Matter — PatternProof" },
      {
        property: "og:description",
        content: "One matter: its details, the client file attached to it, and assigned advocates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MatterDetail,
});

type Data = Awaited<ReturnType<typeof getMatter>>;

function MatterDetail() {
  const { matterId } = Route.useParams();
  const fetchMatter = useServerFn(getMatter);
  const save = useServerFn(updateMatter);
  const invite = useServerFn(inviteAdvocateToMatter);
  const dropInvite = useServerFn(revokeMatterInvitation);
  const dropAdvocate = useServerFn(revokeMatterAdvocate);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetchMatter({ data: { id: matterId } })
        .then((d) => {
          setData(d);
          setErr(null);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "We couldn't open that matter.")),
    [fetchMatter, matterId],
  );
  useEffect(() => {
    void reload();
  }, [reload]);

  if (err) return <div style={folio.page}>{err}</div>;
  if (!data) return <div style={folio.page}>Loading this matter…</div>;

  const { matter, advocates, invitations, links, client_user_id } = data;

  async function attach(linkId: string) {
    try {
      await save({ data: { id: matterId, client_link_id: linkId || null } });
      await reload();
      toast("Saved. The matter now points at that shared file.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't save that. Try again in a moment.");
    }
  }

  async function sendInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const res = await invite({
        data: {
          matter_id: matterId,
          email: String(f.get("email") ?? ""),
          name: String(f.get("name") ?? ""),
          expires_days: 14,
        },
      });
      setInviteLink(`${window.location.origin}${res.acceptPath}`);
      form.reset();
      await reload();
      toast("Invitation ready. Share the link with the advocate.");
    } catch (e2) {
      toast(e2 instanceof Error ? e2.message : "We couldn't create that invitation.");
    }
  }

  return (
    <div style={folio.page}>
      <div style={folio.eyebrow}>Matter</div>
      <h1 style={folio.h1}>{matter.matter_name}</h1>
      <p style={folio.lede}>
        {[
          matter.matter_number ? `No. ${matter.matter_number}` : null,
          matter.case_type,
          matter.court,
          matter.jurisdiction,
          matter.status === "closed" ? "Closed" : "Open",
        ]
          .filter(Boolean)
          .join(" · ") || "No details recorded yet."}
      </p>

      <section style={{ ...folio.card, marginBottom: 24 }}>
        <h2 style={folio.h2}>Client's shared file</h2>
        {client_user_id ? (
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>
            Attached to Client {client_user_id.slice(0, 8)}.{" "}
            <Link
              to="/clients/$clientId"
              params={{ clientId: client_user_id }}
              style={{ color: "var(--indigo)" }}
            >
              Open the shared case
            </Link>
          </p>
        ) : (
          <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: "0 0 12px" }}>
            Nothing attached yet. You'll only see files a client has chosen to share with you.
          </p>
        )}
        <label style={folio.label} htmlFor="attach">
          Attach a shared file
        </label>
        <select
          id="attach"
          style={{ ...folio.input, maxWidth: 340 }}
          value={matter.client_link_id ?? ""}
          onChange={(e) => void attach(e.target.value)}
        >
          <option value="">Not attached</option>
          {links.map((l) => (
            <option key={l.id} value={l.id}>
              Client {l.client_user_id.slice(0, 8)}
            </option>
          ))}
        </select>
      </section>

      <section style={folio.card}>
        <h2 style={folio.h2}>Advocates on this matter</h2>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "0 0 14px", maxWidth: 560 }}>
          An advocate you invite here can open this matter only. They see nothing else in your
          practice, and you can withdraw their access at any time.
        </p>

        <form onSubmit={sendInvite} style={{ display: "grid", gap: 12, maxWidth: 460 }}>
          <div>
            <label style={folio.label} htmlFor="name">
              Advocate name (optional)
            </label>
            <input id="name" name="name" style={folio.input} />
          </div>
          <div>
            <label style={folio.label} htmlFor="email">
              Advocate email
            </label>
            <input id="email" name="email" type="email" required style={folio.input} />
          </div>
          <div>
            <button type="submit" style={folio.btn}>
              Create invitation
            </button>
          </div>
        </form>

        {inviteLink && (
          <div style={{ marginTop: 14 }}>
            <div style={folio.mono}>{inviteLink}</div>
            <button
              type="button"
              style={{ ...folio.btnQuiet, marginTop: 8 }}
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                toast("Link copied.");
              }}
            >
              Copy link
            </button>
          </div>
        )}

        <hr style={folio.rule} />

        <h2 style={folio.h2}>Assigned</h2>
        {advocates.filter((a) => !a.revoked_at).length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>No advocate assigned yet.</p>
        )}
        {advocates
          .filter((a) => !a.revoked_at)
          .map((a) => (
            <Row
              key={a.id}
              main={a.advocate_name ?? a.advocate_email ?? "Advocate"}
              detail={a.advocate_email ?? ""}
              action="Withdraw access"
              onAction={async () => {
                await dropAdvocate({ data: { id: a.id } });
                await reload();
                toast("Access withdrawn.");
              }}
            />
          ))}

        <h2 style={{ ...folio.h2, marginTop: 22 }}>Invitations</h2>
        {invitations.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>None sent yet.</p>
        )}
        {invitations.map((i) => (
          <Row
            key={i.id}
            main={i.advocate_email}
            detail={`${i.status} · expires ${new Date(i.expires_at).toLocaleDateString()}`}
            action={i.status === "pending" ? "Cancel" : undefined}
            onAction={async () => {
              await dropInvite({ data: { id: i.id } });
              await reload();
              toast("Invitation cancelled.");
            }}
          />
        ))}
      </section>
    </div>
  );
}

function Row({
  main,
  detail,
  action,
  onAction,
}: {
  main: string;
  detail: string;
  action?: string;
  onAction?: () => void | Promise<void>;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div>
        <div style={{ fontSize: 14 }}>{main}</div>
        <div style={folio.mono}>{detail}</div>
      </div>
      {action && (
        <button type="button" style={folio.btnQuiet} onClick={() => void onAction?.()}>
          {action}
        </button>
      )}
    </div>
  );
}
