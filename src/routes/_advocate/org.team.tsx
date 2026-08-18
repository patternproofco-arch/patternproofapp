import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMyOrgWorkspace,
  inviteOrgMember,
  revokeOrgInvite,
  removeOrgMember,
  createOrgWorkspace,
} from "@/lib/workspaces.functions";

export const Route = createFileRoute("/_advocate/org/team")({
  component: OrgTeamPage,
});

type Workspace = Awaited<ReturnType<typeof getMyOrgWorkspace>>;

function OrgTeamPage() {
  const load = useServerFn(getMyOrgWorkspace);
  const invite = useServerFn(inviteOrgMember);
  const revoke = useServerFn(revokeOrgInvite);
  const remove = useServerFn(removeOrgMember);
  const create = useServerFn(createOrgWorkspace);

  const [data, setData] = useState<Workspace | null>(null);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    load().then(setData).catch(() => setData(null));
  }, [load]);
  useEffect(refresh, [refresh]);

  const ws = data?.workspace ?? null;
  const isOwner = data?.myRole === "owner";

  const copyLink = (token: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/team-invite/${token}`);
    toast("Invite link copied. Send it however feels safest.");
  };

  const onInvite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const { invite: created } = await invite({ data: { email: email.trim(), role: "member" } });
      setEmail("");
      copyLink(created.invite_token);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't create that invite. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="orgx-eyebrow">Organization</p>
      <h1 style={{ margin: "8px 0 10px" }}>Team</h1>
      <p className="orgx-muted" style={{ fontSize: 14, maxWidth: 640 }}>
        Everyone in this organization workspace sees the same shared workspaces. Seats are free and
        unlimited for domestic violence organizations.
      </p>

      {data === null ? (
        <div className="orgx-card" style={{ marginTop: 20 }}>
          <p className="orgx-muted" style={{ fontSize: 14 }}>Loading…</p>
        </div>
      ) : !ws ? (
        <div className="orgx-card" style={{ marginTop: 20, display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0 }}>No organization workspace yet</h2>
          <p className="orgx-muted" style={{ fontSize: 14 }}>
            Name your organization to create one. You'll be its owner and can add colleagues.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="orgx-input"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization name"
              style={{ flex: "1 1 260px" }}
            />
            <button
              className="orgx-btn"
              disabled={busy || orgName.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  await create({ data: { name: orgName.trim() } });
                  toast("Workspace created. You're the owner.");
                  refresh();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "We couldn't create that workspace.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create workspace
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="orgx-card" style={{ marginTop: 20 }}>
            <h2 style={{ margin: 0 }}>{ws.name}</h2>
            <p className="orgx-muted" style={{ fontSize: 13.5, marginTop: 8 }}>
              {ws.seatsUsed} {ws.seatsUsed === 1 ? "person" : "people"} in this workspace · unlimited seats
            </p>
          </div>

          {isOwner && (
            <div className="orgx-card" style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Invite a colleague</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  className="orgx-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@organization.org"
                  style={{ flex: "1 1 280px" }}
                />
                <button className="orgx-btn" onClick={onInvite} disabled={busy}>
                  Create invite link
                </button>
              </div>
            </div>
          )}

          <div className="orgx-card" style={{ marginTop: 16 }}>
            <h2 style={{ margin: 0 }}>Members</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 12, fontSize: 14 }}>
              {data.members.map((m) => (
                <div key={m.user_id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>
                    {m.name ?? m.email ?? "Team member"}{" "}
                    <span className="orgx-muted">· {m.role}</span>
                  </span>
                  {isOwner && m.role !== "owner" && (
                    <button
                      className="orgx-btn-ghost"
                      onClick={async () => {
                        try {
                          await remove({ data: { userId: m.user_id } });
                          refresh();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "We couldn't remove them right now.");
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {data.invites.length > 0 && (
            <div className="orgx-card" style={{ marginTop: 16 }}>
              <h2 style={{ margin: 0 }}>Pending invites</h2>
              <div style={{ display: "grid", gap: 8, marginTop: 12, fontSize: 14 }}>
                {data.invites.map((i) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{i.email}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button className="orgx-btn-ghost" onClick={() => copyLink(i.invite_token)}>Copy link</button>
                      {isOwner && (
                        <button
                          className="orgx-btn-ghost"
                          onClick={async () => {
                            await revoke({ data: { id: i.id } });
                            refresh();
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
