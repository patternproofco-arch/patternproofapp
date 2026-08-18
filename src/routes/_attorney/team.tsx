import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Copy, X } from "lucide-react";
import { toast } from "sonner";
import {
  getMyFirmWorkspace,
  inviteFirmMember,
  revokeFirmInvite,
  removeFirmMember,
  createFirmWorkspace,
} from "@/lib/workspaces.functions";
import { FIRM_INCLUDED_SEATS, FIRM_MAX_SEATS, SEAT_PRICE_CENTS } from "@/lib/workspace-seats";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

export const Route = createFileRoute("/_attorney/team")({
  component: TeamPage,
  head: () => ({
    meta: [
      { title: "PatternProof — Firm workspace and seats" },
      { name: "description", content: "Manage who at your firm can see the firm's PatternProof matters, and how many seats your workspace has." },
      { property: "og:title", content: "PatternProof — Firm workspace and seats" },
      { property: "og:description", content: "Invite colleagues, review pending invites, and track seat usage for your firm workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Workspace = Awaited<ReturnType<typeof getMyFirmWorkspace>>;

function TeamPage() {
  const load = useServerFn(getMyFirmWorkspace);
  const invite = useServerFn(inviteFirmMember);
  const revoke = useServerFn(revokeFirmInvite);
  const remove = useServerFn(removeFirmMember);
  const create = useServerFn(createFirmWorkspace);

  const [data, setData] = useState<Workspace | null>(null);
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyingSeats, setBuyingSeats] = useState<number | null>(null);

  const refresh = useCallback(() => {
    load().then(setData).catch(() => setData(null));
  }, [load]);
  useEffect(refresh, [refresh]);

  const ws = data?.workspace ?? null;
  const isOwner = data?.myRole === "owner";
  const seatsLeft = ws ? Math.max(0, ws.seatsPurchased - ws.seatsUsed) : 0;

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/team-invite/${token}`;
    void navigator.clipboard.writeText(url);
    toast("Invite link copied. Send it however you normally reach your colleague.");
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

  const onCreateWorkspace = async () => {
    if (firmName.trim().length < 2 || busy) return;
    setBusy(true);
    try {
      await create({ data: { name: firmName.trim() } });
      toast("Workspace created. You're the owner.");
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't create that workspace.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 900, margin: "0 auto" }}>
      <div>
        <div className="att-eyebrow">Practice · Workspace</div>
        <h1 className="att-page-title">Team</h1>
        <p style={{ fontSize: 13, color: "var(--att-text-2)", marginTop: 6, lineHeight: 1.6 }}>
          Everyone in this workspace can see the firm's matters. The attorney who onboarded a client
          stays recorded on that client's link.
        </p>
      </div>

      {data === null ? (
        <div className="att-card" style={{ fontSize: 13, color: "var(--att-text-2)" }}>Loading…</div>
      ) : !ws ? (
        <div className="att-card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>No firm workspace yet</h2>
          <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.6 }}>
            Solo accounts don't need one. If you're on the Firm plan, name your workspace and you can
            invite up to {FIRM_MAX_SEATS} people in total.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="att-input"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Firm name"
              style={{ flex: "1 1 260px" }}
            />
            <button className="att-btn-primary" disabled={busy} onClick={onCreateWorkspace}>
              Create workspace
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="att-card" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={15} />
              <h2 style={{ margin: 0, fontSize: 16 }}>{ws.name}</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
              {ws.seatsUsed} of {ws.seatsPurchased} seats used
              {ws.seatsPurchased < FIRM_MAX_SEATS ? ` · up to ${FIRM_MAX_SEATS} allowed` : " · at the cap"}
              {" · "}{FIRM_INCLUDED_SEATS} included with the Firm plan
            </p>
          </div>

          {isOwner && (
            <div className="att-card" style={{ display: "grid", gap: 10 }}>
              <label className="att-eyebrow" htmlFor="invite-email">Invite a teammate</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  id="invite-email"
                  className="att-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@firm.com"
                  style={{ flex: "1 1 280px" }}
                />
                <button className="att-btn-primary" onClick={onInvite} disabled={busy || seatsLeft <= 0}>
                  <UserPlus size={13} style={{ marginRight: 6 }} />
                  {seatsLeft > 0 ? "Create invite link" : "No seats left"}
                </button>
              </div>
              {seatsLeft <= 0 && (
                <p style={{ fontSize: 12.5, color: "var(--att-text-2)" }}>
                  Add a seat below to invite another person.
                </p>
              )}
            </div>
          )}

          <div className="att-card">
            <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Members</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {data.members.map((m) => (
                <div key={m.user_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <span>
                    {m.name ?? m.email ?? "Team member"}{" "}
                    <span style={{ color: "var(--att-text-2)" }}>· {m.role}</span>
                  </span>
                  {isOwner && m.role !== "owner" && (
                    <button
                      className="att-btn-ghost"
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
            <div className="att-card">
              <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Pending invites</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {data.invites.map((i) => (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span>{i.email}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button className="att-btn-ghost" onClick={() => copyLink(i.invite_token)}>
                        <Copy size={12} style={{ marginRight: 4 }} />Copy link
                      </button>
                      {isOwner && (
                        <button
                          className="att-btn-ghost"
                          onClick={async () => {
                            await revoke({ data: { id: i.id } });
                            refresh();
                          }}
                        >
                          <X size={12} style={{ marginRight: 4 }} />Cancel
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOwner && (
            <div className="att-card" style={{ display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Seats</h2>
              <p style={{ fontSize: 13, color: "var(--att-text-2)", lineHeight: 1.6 }}>
                The Firm plan includes {FIRM_INCLUDED_SEATS} seats. Extra seats are $
                {(SEAT_PRICE_CENTS / 100).toFixed(0)}/month each, up to {FIRM_MAX_SEATS} total.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Array.from({ length: FIRM_MAX_SEATS - FIRM_INCLUDED_SEATS }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={buyingSeats === n ? "att-btn-primary" : "att-btn-ghost"}
                    onClick={() => setBuyingSeats(n)}
                  >
                    +{n} seat{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
              {buyingSeats !== null && (
                <div style={{ marginTop: 8 }}>
                  <SeatCheckout extraSeats={buyingSeats} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SeatCheckout({ extraSeats }: { extraSeats: number }) {
  return (
    <StripeEmbeddedCheckout
      seatQuantity={extraSeats}
      returnUrl={`${window.location.origin}/billing-return?session_id={CHECKOUT_SESSION_ID}`}
    />
  );
}
