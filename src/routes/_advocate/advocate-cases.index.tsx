import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Clock3, Mail, Plus, X, Send, Copy, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { listAdvocateClients } from "@/lib/advocate.functions";
import {
  createAdvocateSurvivorInvite,
  listAdvocateSurvivorInvites,
  revokeAdvocateSurvivorInvite,
  resendAdvocateSurvivorInvite,
} from "@/lib/advocate-survivor-invites.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { PortalStatHero } from "@/components/shared/PortalStatHero";
import { RecentActivityList, type ActivityRow } from "@/components/shared/RecentActivityList";
import { portalTheme } from "@/components/shared/portal-theme";
import { FocusRegion } from "@/components/survivor/focus-mode";

export const Route = createFileRoute("/_advocate/advocate-cases/")({
  component: AdvocateCases,
});

type Clients = Awaited<ReturnType<typeof listAdvocateClients>>["clients"];
type InviteRow = Awaited<ReturnType<typeof listAdvocateSurvivorInvites>>["invites"][number];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "rgba(47,107,79,0.12)", fg: "#2F6B4F", label: "Pending" },
  accepted: { bg: "rgba(34,120,80,0.15)", fg: "#1B6B45", label: "Accepted" },
  revoked: { bg: "rgba(120,40,40,0.12)", fg: "#8B2E2E", label: "Revoked" },
  declined: { bg: "rgba(100,90,60,0.14)", fg: "#6B5B2E", label: "Declined" },
  expired: { bg: "rgba(90,90,90,0.12)", fg: "#555", label: "Expired" },
};

function AdvocateCases() {
  const t = portalTheme("advocate");
  const listFn = useServerFn(listAdvocateClients);
  const listInvitesFn = useServerFn(listAdvocateSurvivorInvites);
  const [clients, setClients] = useState<Clients | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);

  const loadInvites = useCallback(() => {
    listInvitesFn()
      .then((r) => setInvites(r.invites))
      .catch(() => setInvites([]));
  }, [listInvitesFn]);

  useEffect(() => {
    listFn()
      .then((r) => setClients(r.clients))
      .catch(() => setClients([]));
  }, [listFn]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const active = (clients ?? []).filter((c) => c.status === "active");
  const withdrawn = (clients ?? []).filter((c) => c.status !== "active");

  const followUp: ActivityRow[] | null =
    clients === null
      ? null
      : active.map((c) => ({
          id: c.id,
          icon: FolderOpen,
          title: c.case_label ?? "Case",
          timestamp: `shared ${new Date(c.created_at).toLocaleDateString()}`,
          to: "/advocate-cases/$clientId",
          params: { clientId: c.client_user_id },
          highlight: true,
        }));

  const closed: ActivityRow[] = withdrawn.map((c) => ({
    id: c.id,
    icon: Clock3,
    title: c.case_label ?? "Case",
    timestamp: c.revoked_at
      ? `access withdrawn ${new Date(c.revoked_at).toLocaleDateString()}`
      : "access withdrawn",
  }));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PortalStatHero
        variant="advocate"
        eyebrow="Your caseload"
        heading="Cases shared with you"
        value={clients === null ? "—" : active.length}
        label={active.length === 1 ? "case open to you" : "cases open to you"}
        message="Read-only. Access is given by the survivor and can be withdrawn at any time."
      />

      <InvitePanel invites={invites} onChange={loadInvites} />

      <FocusRegion id="advocate-followup">
        <RecentActivityList
          variant="advocate"
          title="Needs follow-up"
          rows={followUp}
          emptyMessage="Nothing here yet — invite a survivor by email, or wait until someone shares with you."
        />
      </FocusRegion>

      {closed.length > 0 ? (
        <FocusRegion id="advocate-closed">
          <RecentActivityList variant="advocate" title="No longer shared" rows={closed} />
        </FocusRegion>
      ) : null}

      <p style={{ margin: 0, fontSize: 12, color: t.muted }}>
        <Link to="/advocate-cases" style={{ color: t.accent }}>
          Refresh your list
        </Link>{" "}
        if something looks out of date.
      </p>
    </div>
  );
}

function InvitePanel({ invites, onChange }: { invites: InviteRow[] | null; onChange: () => void }) {
  const t = portalTheme("advocate");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createAdvocateSurvivorInvite);
  const revoke = useServerFn(revokeAdvocateSurvivorInvite);
  const resend = useServerFn(resendAdvocateSurvivorInvite);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await create({
        data: {
          survivor_email: email.trim(),
          survivor_name: name.trim() || null,
          personal_note: note.trim() || null,
          expires_days: 30,
        },
      });
      const acceptUrl = `${window.location.origin}/advocate-survivor-invite/${r.invite.invite_token}`;
      const sent = await sendTransactionalEmail({
        templateName: "advocate-survivor-invitation",
        recipientEmail: r.invite.survivor_email,
        idempotencyKey: `advocate-survivor-invitation-${r.invite.id}`,
        templateData: {
          acceptUrl,
          expiresLabel: "30 days",
          survivorName: name.trim() || undefined,
          personalNote: note.trim() || undefined,
        },
      });
      await recordEmail({ data: { id: r.invite.id, sent } }).catch(() => undefined);
      if (sent) {
        toast("Invite email sent. The survivor must explicitly Accept before you get access.");
      } else {
        toast(
          "Invite created, but the email couldn't be sent. Copy the link below to share securely.",
        );
      }
      setEmail("");
      setName("");
      setNote("");
      onChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send invite.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/advocate-survivor-invite/${token}`;
    navigator.clipboard.writeText(url).then(() => toast("Invite link copied."));
  };

  return (
    <section
      style={{
        padding: 18,
        borderRadius: 18,
        background: t.card,
        boxShadow: "var(--pp-shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.08,
              textTransform: "uppercase",
              color: t.muted,
            }}
          >
            Survivor invites
          </div>
          <h2 style={{ fontSize: 20, margin: "4px 0 0", fontWeight: 600 }}>
            Invite a survivor by email
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.muted, maxWidth: 520 }}>
            We email them a secure link. Opening it grants nothing — they must Accept with a
            checklist. Decline, expire, or revoke means you cannot read their vault.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={btn(t.accent, true)}
          >
            <Plus size={14} /> Invite by email
          </button>
          {open && (
            <button type="button" onClick={() => setOpen(false)} style={btn(t.muted, false)}>
              <X size={12} /> Close
            </button>
          )}
        </div>
      </div>

      {open && (
        <form
          onSubmit={submit}
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            background: t.ground,
            boxShadow: "var(--pp-shadow-in-sm)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={eyebrow(t.muted)}>Survivor email *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="name@example.com"
                style={input}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={eyebrow(t.muted)}>Survivor name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Optional"
                style={input}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={eyebrow(t.muted)}>Personal note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Shown with your invite. Keep it brief and warm."
              style={{ ...input, resize: "vertical" }}
            />
          </label>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 12, color: t.muted }}>
              Email goes out automatically. Expires in 30 days. They control what they share.
            </span>
            <button type="submit" disabled={saving} style={btn(t.accent, true)}>
              <Send size={13} /> {saving ? "Sending…" : "Send invite email"}
            </button>
          </div>
        </form>
      )}

      {invites === null ? null : invites.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: t.muted,
            fontSize: 13,
            padding: "8px 0",
          }}
        >
          <Mail size={16} />
          No invites sent yet. Invite by email above — no org-wide survivor directory.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {invites.map((inv) => {
            const s = STATUS_STYLE[inv.effective_status] ?? STATUS_STYLE.pending;
            const link = `${typeof window === "undefined" ? "" : window.location.origin}/advocate-survivor-invite/${inv.invite_token}`;
            const isPending = inv.effective_status === "pending";
            const isExpired = inv.effective_status === "expired";
            const canResend =
              isPending ||
              isExpired ||
              inv.effective_status === "revoked" ||
              inv.effective_status === "declined";
            return (
              <div
                key={inv.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 14,
                  background: t.ground,
                  boxShadow: "var(--pp-shadow-in-sm)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>
                      {inv.survivor_name || inv.survivor_email}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: s.bg,
                        color: s.fg,
                      }}
                    >
                      {s.label}
                    </span>
                    {inv.survivor_name && (
                      <span style={{ fontSize: 12, color: t.muted }}>{inv.survivor_email}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>
                    Sent {new Date(inv.created_at).toLocaleDateString()}
                    {inv.accepted_at && (
                      <> · accepted {new Date(inv.accepted_at).toLocaleDateString()}</>
                    )}
                    {inv.declined_at && (
                      <> · declined {new Date(inv.declined_at).toLocaleDateString()}</>
                    )}
                    {isPending && inv.expires_at && (
                      <> · expires {new Date(inv.expires_at).toLocaleDateString()}</>
                    )}
                  </div>
                  {isPending && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: t.accent,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {link}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {isPending && (
                    <button type="button" onClick={() => copyLink(inv.invite_token)} style={btn(t.muted, false)}>
                      <Copy size={12} /> Copy link
                    </button>
                  )}
                  {canResend && inv.effective_status !== "accepted" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await resend({ data: { id: inv.id, expires_days: 30 } });
                          const acceptUrl = `${window.location.origin}/advocate-survivor-invite/${r.invite.invite_token}`;
                          const sent = await sendTransactionalEmail({
                            templateName: "advocate-survivor-invitation",
                            recipientEmail: r.invite.survivor_email,
                            idempotencyKey: `advocate-survivor-invitation-resend-${r.invite.id}-${Date.now()}`,
                            templateData: { acceptUrl, expiresLabel: "30 days" },
                          });
                          toast(
                            sent
                              ? "Invite email resent for 30 more days."
                              : "Invite renewed; email couldn't be sent — copy the link.",
                          );
                          onChange();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "Couldn't resend.");
                        }
                      }}
                      style={btn(t.muted, false)}
                    >
                      <RotateCw size={12} /> {isExpired ? "Renew" : "Resend"}
                    </button>
                  )}
                  {(isPending || isExpired) && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await revoke({ data: { id: inv.id } });
                          toast("Invite revoked. No new access from this invite.");
                          onChange();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "Couldn't revoke.");
                        }
                      }}
                      style={btn("#8B2E2E", false)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function eyebrow(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.08,
    textTransform: "uppercase",
    color,
  };
}

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "none",
  boxShadow: "var(--pp-shadow-in-sm)",
  background: "var(--pp-card, #fff)",
  fontSize: 14,
  fontFamily: "inherit",
};

function btn(color: string, primary: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    background: primary ? color : "transparent",
    color: primary ? "#fff" : color,
    boxShadow: primary ? "var(--pp-shadow-sm)" : "none",
  };
}
