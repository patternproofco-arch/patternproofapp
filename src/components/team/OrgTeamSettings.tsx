import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, MailPlus, ShieldCheck, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  changeOrgMemberRole,
  createOrgMemberInvitation,
  getMyOrgTeam,
  leaveMyOrg,
  removeOrgMember,
  revokeOrgMemberInvitation,
} from "@/lib/org-portal.functions";

type TeamData = Awaited<ReturnType<typeof getMyOrgTeam>>;

export function OrgTeamSettings() {
  const getTeam = useServerFn(getMyOrgTeam);
  const invite = useServerFn(createOrgMemberInvitation);
  const revoke = useServerFn(revokeOrgMemberInvitation);
  const changeRole = useServerFn(changeOrgMemberRole);
  const remove = useServerFn(removeOrgMember);
  const leave = useServerFn(leaveMyOrg);
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<{ email: string; url: string } | null>(null);
  const load = useCallback(
    () =>
      getTeam()
        .then(setData)
        .catch(() => toast.error("Could not load team settings.")),
    [getTeam],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!data)
    return (
      <section style={card}>
        <p>Loading team settings…</p>
      </section>
    );
  const actorRole = data.membership.role;
  const manager = actorRole === "owner" || actorRole === "admin";
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: "grid", gap: 14, marginTop: 32 }}>
      <div>
        <div style={eyebrow}>Team settings</div>
        <h2 style={{ margin: "4px 0" }}>{data.org?.name}</h2>
        <p style={muted}>
          Separate verified logins only. Team members never receive survivor identities or records.
        </p>
      </div>
      {manager && (
        <form
          style={card}
          onSubmit={(e) => {
            e.preventDefault();
            const invitedEmail = email;
            void run(async () => {
              const result = await invite({ data: { email, role, expires_days: 7 } });
              setLastInviteLink({ email: invitedEmail, url: result.acceptUrl });
              setEmail("");
            }, "Invitation created.");
          }}
        >
          <h3 style={title}>
            <MailPlus size={17} /> Invite teammate
          </h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 150px auto", gap: 8 }}
          >
            <input
              style={input}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="advocate@example.org"
            />
            <select
              style={input}
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
            >
              <option value="member">Member</option>
              {actorRole === "owner" && <option value="admin">Administrator</option>}
            </select>
            <button style={button} disabled={busy}>
              Send invite
            </button>
          </div>
        </form>
      )}

      {lastInviteLink && (
        <div style={card}>
          <h3 style={title}>
            <Copy size={17} /> Invite link for {lastInviteLink.email}
          </h3>
          <p style={muted}>
            The invitation email may take a few minutes to arrive. If it doesn't, copy this link and
            send it to them directly (Slack, text, etc.) — it works the same way.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ ...input, flex: 1, minWidth: 240 }}
              readOnly
              value={lastInviteLink.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              style={button}
              onClick={() => {
                void navigator.clipboard.writeText(lastInviteLink.url);
                toast.success("Invite link copied.");
              }}
            >
              <Copy size={13} /> Copy link
            </button>
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={title}>
          <Users size={17} /> Members
        </h3>
        {data.members.map((m) => {
          const canEdit = actorRole === "owner" && m.role !== "owner" && !m.is_current_user;
          const canRemove =
            !m.is_current_user &&
            m.role !== "owner" &&
            (actorRole === "owner" || (actorRole === "admin" && m.role === "member"));
          return (
            <div key={m.user_id} style={row}>
              <div>
                <strong>{m.full_name || m.email || "Team member"}</strong>
                <div style={muted}>
                  {m.email}
                  {m.is_current_user ? " · You" : ""}
                </div>
              </div>
              {canEdit ? (
                <select
                  style={input}
                  value={m.role}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () =>
                        changeRole({
                          data: { user_id: m.user_id, role: e.target.value as "admin" | "member" },
                        }),
                      "Role updated.",
                    )
                  }
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              ) : (
                <span>{m.role}</span>
              )}
              {canRemove && (
                <button
                  style={button}
                  disabled={busy}
                  onClick={() =>
                    window.confirm("Remove this member?") &&
                    void run(() => remove({ data: { user_id: m.user_id } }), "Member removed.")
                  }
                >
                  <UserMinus size={13} /> Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {manager && data.invitations.some((i) => i.status === "pending") && (
        <div style={card}>
          <h3>Pending invitations</h3>
          {data.invitations
            .filter((i) => i.status === "pending")
            .map((i) => (
              <div key={i.id} style={row}>
                <span>
                  {i.email} · {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                </span>
                <span />
                <button
                  style={button}
                  disabled={busy}
                  onClick={() =>
                    void run(() => revoke({ data: { id: i.id } }), "Invitation revoked.")
                  }
                >
                  <Trash2 size={13} /> Revoke
                </button>
              </div>
            ))}
        </div>
      )}

      <div style={card}>
        <h3 style={title}>
          <ShieldCheck size={17} /> Team audit
        </h3>
        {data.audit.length ? (
          data.audit.map((a) => (
            <div key={a.id} style={{ fontSize: 12, padding: "5px 0" }}>
              {new Date(a.created_at).toLocaleString()} ·{" "}
              {a.event_type.replace("team.", "").replaceAll("_", " ")}
            </div>
          ))
        ) : (
          <p style={muted}>No team changes recorded yet.</p>
        )}
      </div>
      {actorRole !== "owner" && (
        <button
          style={button}
          disabled={busy}
          onClick={() =>
            window.confirm("Leave this organization?") &&
            void run(() => leave(), "You left the organization.")
          }
        >
          <UserMinus size={13} /> Leave organization
        </button>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  background: "var(--pp-card)",
  borderRadius: 18,
  boxShadow: "var(--pp-shadow-sm)",
  padding: 16,
};
const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(200px,1fr) 150px auto",
  gap: 10,
  alignItems: "center",
  padding: "9px 0",
  borderBottom: "1px solid var(--border)",
};
const input: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 10px",
  background: "var(--pp-card)",
};
const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 12px",
  background: "var(--pp-card)",
  fontWeight: 700,
  cursor: "pointer",
};
const title: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const muted: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted-foreground)",
  margin: "3px 0",
};
const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted-foreground)",
};
