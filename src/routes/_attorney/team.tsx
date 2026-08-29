import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, MailPlus, ShieldCheck, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  changeFirmMemberRole,
  createFirmMemberInvitation,
  getMyFirm,
  leaveMyFirm,
  removeFirmMember,
  revokeFirmMemberInvitation,
  setMyFirm,
} from "@/lib/firm-grants.functions";
import { FIRM_SEAT_MAX } from "@/lib/pricing-tiers";

export const Route = createFileRoute("/_attorney/team")({ component: FirmTeamSettings });

type TeamData = Awaited<ReturnType<typeof getMyFirm>>;

function FirmTeamSettings() {
  const getTeam = useServerFn(getMyFirm);
  const invite = useServerFn(createFirmMemberInvitation);
  const revoke = useServerFn(revokeFirmMemberInvitation);
  const changeRole = useServerFn(changeFirmMemberRole);
  const remove = useServerFn(removeFirmMember);
  const leave = useServerFn(leaveMyFirm);
  const createFirm = useServerFn(setMyFirm);
  const [data, setData] = useState<TeamData | null>(null);
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<{ email: string; url: string } | null>(null);
  const load = useCallback(
    () =>
      getTeam()
        .then(setData)
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load team.")),
    [getTeam],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const seats = useMemo(() => {
    const included = data?.firm?.seats_included ?? 1;
    const purchased = data?.firm?.seats_purchased ?? 0;
    return { used: data?.members.length ?? 0, total: Math.max(1, included + purchased) };
  }, [data]);

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

  if (!data) return <div className="att-card">Loading team settings…</div>;
  if (!data.firm || !data.membership) {
    return (
      <form
        className="att-card"
        style={{ maxWidth: 720, display: "grid", gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await createFirm({ data: { name: firmName } });
            setFirmName("");
          }, "Firm team created.");
        }}
      >
        <h1 className="att-page-title">Create your firm team</h1>
        <p>
          Your active Firm plan includes up to {FIRM_SEAT_MAX} separate verified logins. Creating a
          team never joins or combines accounts by matching a firm name.
        </p>
        <input
          className="att-input"
          required
          minLength={2}
          maxLength={200}
          value={firmName}
          onChange={(event) => setFirmName(event.target.value)}
          placeholder="Firm legal or operating name"
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="att-btn att-btn-primary" disabled={busy}>
            Create firm team
          </button>
          <Link to="/billing" className="att-btn">
            Review Firm plan
          </Link>
        </div>
      </form>
    );
  }
  const actorRole = data.membership.role;
  const manager = actorRole === "owner" || actorRole === "admin";

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 980, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Settings · Team</div>
        <h1 className="att-page-title">{data.firm.name}</h1>
        <p style={{ color: "var(--att-text-2)" }}>
          Every seat has a separate verified login. Case access is still granted matter by matter.
        </p>
      </div>

      <div
        className="att-card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="att-eyebrow">Firm seats</div>
          <strong style={{ fontSize: 22 }}>
            {seats.used} of {seats.total} used
          </strong>
        </div>
        <Link to="/billing" className="att-btn att-btn-primary">
          Manage seats &amp; billing
        </Link>
      </div>

      {manager && (
        <form
          className="att-card"
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
          <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <MailPlus size={18} /> Invite a teammate
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px,1fr) 160px auto",
              gap: 10,
            }}
          >
            <input
              className="att-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
            <select
              className="att-input"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
            >
              <option value="member">Member</option>
              {actorRole === "owner" && <option value="admin">Administrator</option>}
            </select>
            <button className="att-btn att-btn-primary" disabled={busy}>
              Send invite
            </button>
          </div>
        </form>
      )}

      {lastInviteLink && (
        <div className="att-card">
          <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Copy size={18} /> Invite link for {lastInviteLink.email}
          </h2>
          <p style={{ color: "var(--att-text-2)" }}>
            The invitation email may take a few minutes to arrive. If it doesn't, copy this link and
            send it to them directly (Slack, text, etc.) — it works the same way.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="att-input"
              readOnly
              value={lastInviteLink.url}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: 1, minWidth: 260 }}
            />
            <button
              type="button"
              className="att-btn"
              onClick={() => {
                void navigator.clipboard.writeText(lastInviteLink.url);
                toast.success("Invite link copied.");
              }}
            >
              <Copy size={14} /> Copy link
            </button>
          </div>
        </div>
      )}

      <div className="att-card">
        <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Users size={18} /> Members
        </h2>
        <div style={{ display: "grid", gap: 8 }}>
          {data.members.map((m) => {
            const canEdit = actorRole === "owner" && m.role !== "owner" && !m.is_current_user;
            const canRemove =
              !m.is_current_user &&
              m.role !== "owner" &&
              (actorRole === "owner" || (actorRole === "admin" && m.role === "member"));
            return (
              <div
                key={m.user_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(200px,1fr) 150px auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--att-border)",
                }}
              >
                <div>
                  <strong>{m.full_name || m.email || "Team member"}</strong>
                  <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>
                    {m.email}
                    {m.is_current_user ? " · You" : ""}
                  </div>
                </div>
                {canEdit ? (
                  <select
                    className="att-input"
                    value={m.role}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          changeRole({
                            data: {
                              user_id: m.user_id,
                              role: e.target.value as "admin" | "member",
                            },
                          }),
                        "Role updated.",
                      )
                    }
                  >
                    <option value="member">Member</option>
                    <option value="admin">Administrator</option>
                  </select>
                ) : (
                  <span className="att-tag">{m.role}</span>
                )}
                {canRemove && (
                  <button
                    className="att-btn"
                    disabled={busy}
                    onClick={() =>
                      window.confirm("Remove this member and revoke their firm case grants?") &&
                      void run(
                        () => remove({ data: { user_id: m.user_id } }),
                        "Member removed and grants revoked.",
                      )
                    }
                  >
                    <UserMinus size={14} /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {manager && data.invitations.some((i) => i.status === "pending") && (
        <div className="att-card">
          <h2>Pending invitations</h2>
          {data.invitations
            .filter((i) => i.status === "pending")
            .map((i) => (
              <div
                key={i.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--att-border)",
                }}
              >
                <span>
                  {i.email} · {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                </span>
                <button
                  className="att-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() => revoke({ data: { id: i.id } }), "Invitation revoked.")
                  }
                >
                  <Trash2 size={14} /> Revoke
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="att-card">
        <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={18} /> Team audit
        </h2>
        {data.audit.length ? (
          data.audit.map((a) => (
            <div key={a.id} style={{ fontSize: 12, padding: "6px 0" }}>
              {new Date(a.created_at).toLocaleString()} ·{" "}
              {a.event_type.replace("team.", "").replaceAll("_", " ")}
            </div>
          ))
        ) : (
          <p>No team changes recorded yet.</p>
        )}
      </div>

      {actorRole !== "owner" && (
        <button
          className="att-btn"
          disabled={busy}
          onClick={() =>
            window.confirm("Leave this firm? Your firm case grants will be revoked immediately.") &&
            void run(() => leave(), "You left the firm.")
          }
        >
          <UserMinus size={14} /> Leave firm
        </button>
      )}
    </div>
  );
}
