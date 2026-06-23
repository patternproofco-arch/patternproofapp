import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle, FileText, MessageSquare, TrendingUp, ArrowRight, CheckCircle2,
  Send, Copy, RotateCw, X, Mail, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { listMyClients } from "@/lib/attorney-portal.functions";
import {
  listSurvivorInvites, createSurvivorInvite, revokeSurvivorInvite, resendSurvivorInvite,
} from "@/lib/attorney-survivor-invites.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/_attorney/clients/")({
  component: ClientsIndex,
});

type ClientRow = Awaited<ReturnType<typeof listMyClients>>["clients"][number];
type InviteRow = Awaited<ReturnType<typeof listSurvivorInvites>>["invites"][number];

const RISK: Record<string, { color: string; label: string }> = {
  low: { color: "#10B981", label: "Low" },
  moderate: { color: "#FBBF24", label: "Moderate" },
  elevated: { color: "#F59E0B", label: "Elevated" },
  high: { color: "#EF4444", label: "High" },
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
  accepted: { bg: "#D1FAE5", fg: "#065F46", label: "Accepted" },
  expired: { bg: "#E2E8F0", fg: "#475569", label: "Expired" },
  revoked: { bg: "#FEE2E2", fg: "#991B1B", label: "Revoked" },
};

function ClientsIndex() {
  const fetcher = useServerFn(listMyClients);
  const invitesFetcher = useServerFn(listSurvivorInvites);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const sub = useSubscription();

  useEffect(() => { fetcher().then((r) => setClients(r.clients)); }, [fetcher]);
  useEffect(() => { invitesFetcher().then((r) => setInvites(r.invites)); }, [invitesFetcher]);

  const reloadInvites = () => invitesFetcher().then((r) => setInvites(r.invites));

  return (
    <div>
      <div className="att-eyebrow">Case Files</div>
      <h1 style={{ fontSize: 36, marginTop: 6, marginBottom: 6, fontFamily: '"Instrument Serif", serif', fontWeight: 400 }}>Your clients</h1>
      <p style={{ color: "var(--att-text-2)", maxWidth: 640, marginBottom: 24 }}>
        Every survivor who has shared their P4TTERN PR00F case file with you. Read-only. Chain-of-custody logged.
      </p>

      {/* Diagnosis card — never shows a raw empty grid */}
      <DiagnosisCard clientCount={clients?.length ?? null} tier={sub.tier} />

      <InvitePanel invites={invites} onChange={reloadInvites} />

      {clients === null && (
        <div className="att-card">Loading clients…</div>
      )}

      {clients && clients.length > 0 && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
          {clients.map((c) => {
            const risk = RISK[c.risk_level];
            const caseId = `PP-${c.client_user_id.slice(0, 4).toUpperCase()}`;
            return (
              <Link
                key={c.link_id}
                to="/clients/$clientId"
                params={{ clientId: c.client_user_id }}
                className="att-card att-hover"
                style={{ borderLeft: `3px solid ${risk.color}`, textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div className="att-eyebrow">Case</div>
                    <h3 style={{ fontSize: 22, margin: "2px 0 2px" }}>Client {c.client_user_id.slice(0, 8)}</h3>
                    <div style={{ fontSize: 12, color: "var(--att-text-2)" }}>
                      <span className="att-mono">{caseId}</span> · linked {new Date(c.linked_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span className="att-tag" style={{ background: `${risk.color}1A`, color: risk.color }}>{risk.label}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
                  <Stat icon={<FileText size={12} />} label="Incidents" v={c.incident_count} />
                  <Stat icon={<TrendingUp size={12} />} label="Evidence" v={c.evidence_count} />
                  <Stat icon={<AlertTriangle size={12} />} label="Flags" v={c.escalation_flag_count} />
                </div>
                {(c.unread_messages > 0 || c.open_doc_requests > 0) && (
                  <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 11, color: "var(--att-blue)", fontWeight: 600 }}>
                    {c.unread_messages > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MessageSquare size={11} /> {c.unread_messages} new</span>}
                    {c.open_doc_requests > 0 && <span>{c.open_doc_requests} doc request{c.open_doc_requests === 1 ? "" : "s"}</span>}
                  </div>
                )}
                <div className="att-divider" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--att-text-2)" }}>
                  <span>{c.last_incident_date ? `Latest: ${new Date(c.last_incident_date).toLocaleDateString()}` : "No incidents yet"}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--att-navy)", fontWeight: 600 }}>Open case <ArrowRight size={12} /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ clientCount, tier }: { clientCount: number | null; tier: string }) {
  const tierLabel = tier === "firm" ? "Firm" : tier === "enterprise" ? "Enterprise" : tier === "solo" ? "Solo" : "Solo";
  const cap = tier === "firm" || tier === "enterprise" ? "Unlimited" : "5";
  const status = clientCount === null ? "loading" : clientCount === 0 ? "empty" : "active";
  return (
    <div className="att-card" style={{ marginBottom: 24, borderLeft: "4px solid var(--att-navy)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="att-eyebrow">Portal status</div>
          <h2 style={{ fontSize: 22, margin: "4px 0 6px", fontFamily: '"Instrument Serif", serif' }}>
            {status === "loading" && "Opening your portal…"}
            {status === "empty" && "You're ready. The first invite is the next move."}
            {status === "active" && `${clientCount} client case file${clientCount === 1 ? "" : "s"} active.`}
          </h2>
          <p style={{ fontSize: 13, color: "var(--att-text-2)" }}>
            Plan: <strong>P4TTERN PR00F {tierLabel}</strong> · Client cap: {cap}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          <div className="att-eyebrow">What needs attention</div>
          {status === "empty" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Send size={14} style={{ color: "var(--att-blue)" }} />
              <span>Send your first client an invitation link.</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <CheckCircle2 size={14} style={{ color: "var(--att-green)" }} />
              <span>Open a case file below to begin review.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--att-slate)", fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}>{icon}{label}</div>
      <div style={{ fontSize: 24, fontFamily: '"Instrument Serif", serif', marginTop: 2 }}>{v}</div>
    </div>
  );
}

/* ---------------- Invite panel ---------------- */

function InvitePanel({ invites, onChange }: { invites: InviteRow[] | null; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const create = useServerFn(createSurvivorInvite);
  const revoke = useServerFn(revokeSurvivorInvite);
  const resend = useServerFn(resendSurvivorInvite);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await create({
        data: {
          survivor_email: email.trim(),
          survivor_name: name.trim() || null,
          personal_note: note.trim() || null,
          expires_days: 30,
        },
      });
      toast("Invite sent. Copy the link to share securely.");
      setEmail(""); setName(""); setNote("");
      onChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send invite.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/survivor-invite/${token}`;
    navigator.clipboard.writeText(url).then(() => toast("Invite link copied."));
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="att-eyebrow">Survivor invites</div>
          <h2 style={{ fontSize: 22, marginTop: 4, fontFamily: '"Instrument Serif", serif' }}>
            Invite a survivor to share their case
          </h2>
        </div>
        <button className="att-btn-primary" onClick={() => setOpen((v) => !v)}>
          <Plus size={14} /> {open ? "Hide form" : "New invite"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="att-card" style={{ display: "grid", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="att-eyebrow">Survivor email *</span>
              <input
                className="att-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="name@example.com"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="att-eyebrow">Survivor name</span>
              <input
                className="att-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Optional"
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="att-eyebrow">Personal note</span>
            <textarea
              className="att-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Shown to the survivor with your invite. Keep it brief and warm."
            />
          </label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>
              Invite expires in 30 days. They control what they share.
            </span>
            <button type="submit" disabled={saving} className="att-btn-primary">
              <Send size={13} /> {saving ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {invites === null ? null : invites.length === 0 ? (
        <div className="att-card" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--att-text-2)", fontSize: 13 }}>
          <Mail size={16} style={{ color: "var(--att-slate)" }} />
          No invites sent yet. Send one above to bring a survivor into your portal.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {invites.map((inv) => {
            const s = STATUS_STYLE[inv.effective_status] ?? STATUS_STYLE.pending;
            const link = `${typeof window === "undefined" ? "" : window.location.origin}/survivor-invite/${inv.invite_token}`;
            const isPending = inv.effective_status === "pending";
            const isExpired = inv.effective_status === "expired";
            return (
              <div key={inv.id} className="att-card" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{inv.survivor_name || inv.survivor_email}</strong>
                    <span className="att-tag" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                    {inv.survivor_name && (
                      <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>{inv.survivor_email}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--att-text-2)", marginTop: 4 }}>
                    Sent {new Date(inv.created_at).toLocaleDateString()}
                    {inv.accepted_at && <> · accepted {new Date(inv.accepted_at).toLocaleDateString()}</>}
                    {isPending && inv.expires_at && <> · expires {new Date(inv.expires_at).toLocaleDateString()}</>}
                  </div>
                  {isPending && (
                    <div className="att-mono" style={{ marginTop: 6, fontSize: 11, color: "var(--att-slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {link}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {isPending && (
                    <button className="att-btn-ghost" onClick={() => copyLink(inv.invite_token)} title="Copy invite link">
                      <Copy size={12} /> Copy link
                    </button>
                  )}
                  {(isPending || isExpired) && (
                    <button
                      className="att-btn-ghost"
                      onClick={async () => {
                        try {
                          await resend({ data: { id: inv.id, expires_days: 30 } });
                          toast("Invite reactivated for 30 more days.");
                          onChange();
                        } catch (e) { toast(e instanceof Error ? e.message : "Couldn't resend."); }
                      }}
                    >
                      <RotateCw size={12} /> {isExpired ? "Renew" : "Resend"}
                    </button>
                  )}
                  {(isPending || isExpired) && (
                    <button
                      className="att-btn-ghost"
                      onClick={async () => {
                        if (!confirm("Revoke this invite?")) return;
                        try {
                          await revoke({ data: { id: inv.id } });
                          toast("Invite revoked.");
                          onChange();
                        } catch (e) { toast(e instanceof Error ? e.message : "Couldn't revoke."); }
                      }}
                      style={{ color: "var(--att-red)" }}
                    >
                      <X size={12} /> Revoke
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