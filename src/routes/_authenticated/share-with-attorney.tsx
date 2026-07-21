import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { Copy, Plus, Scale, Trash2, ShieldCheck, Mail, Check, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";
import { createInvitation, listMyInvitations, revokeInvitation, revokeLink } from "@/lib/attorney-invitations.functions";
import { listMessages, sendMessage, markMessagesRead, getMyUnreadCounts } from "@/lib/attorney-portal.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/share-with-attorney")({
  component: ShareWithAttorney,
});

type Listing = Awaited<ReturnType<typeof listMyInvitations>>;

function ShareWithAttorney() {
  const navigate = useNavigate();
  const sub = useSubscription();
  const { confirm, dialog } = useConfirm();
  useEffect(() => {
    if (!sub.loading && sub.tier === "core") {
      navigate({ to: "/court-ready", replace: true });
    }
  }, [sub.loading, sub.tier, navigate]);
  const list = useServerFn(listMyInvitations);
  const create = useServerFn(createInvitation);
  const revokeInv = useServerFn(revokeInvitation);
  const revokeLk = useServerFn(revokeLink);

  const [data, setData] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [messagingLinkId, setMessagingLinkId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [incIncidents, setIncIncidents] = useState(true);
  const [incEvidence, setIncEvidence] = useState(true);
  const [incPatterns, setIncPatterns] = useState(true);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<{ url: string; email: string } | null>(null);

  const unreadFn = useServerFn(getMyUnreadCounts);
  const load = useCallback(() => {
    list().then(setData);
    unreadFn().then((r) => setUnread(r.counts ?? {})).catch(() => setUnread({}));
  }, [list, unreadFn]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      unreadFn().then((r) => setUnread(r.counts ?? {})).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [unreadFn]);

  const submit = async () => {
    if (!email.trim()) { toast("Add an email."); return; }
    setBusy(true);
    try {
      const r = await create({ data: {
        attorney_email: email.trim(),
        attorney_name: name.trim() || undefined,
        firm_name: firm.trim() || undefined,
        personal_note: personalNote.trim() || undefined,
        date_range_start: rangeFrom || null,
        date_range_end: rangeTo || null,
        include_all_incidents: incIncidents,
        include_all_evidence: incEvidence,
        include_patterns: incPatterns,
        expires_days: days,
      } });
      const url = `${window.location.origin}/accept-invite/${r.invitation.invite_token}`;
      setJustCreated({ url, email: email.trim() });
      setOpen(false);
      setEmail(""); setName(""); setFirm(""); setPersonalNote("");
      setRangeFrom(""); setRangeTo("");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't create invitation.");
    } finally { setBusy(false); }
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/accept-invite/${token}`);
    toast("Link copied.");
  };

  return (
    <div>
      <div className="label-eyebrow">Share with attorney</div>
      <h1 className="mt-2 font-serif text-[30px]">Share your case with <em>your attorney</em>.</h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Your attorney will only see what you choose to share. You can revoke access at any time.
      </p>

      {justCreated && (
        <div className="card-pp mt-6" style={{ borderLeft: "3px solid var(--safe)" }}>
          <div className="flex items-center gap-2"><Check size={16} style={{ color: "var(--safe)" }} /><div className="font-serif text-[18px]">Secure access link generated</div></div>
          <div className="mt-2 break-all rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--input)", fontFamily: "monospace" }}>{justCreated.url}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => { navigator.clipboard.writeText(justCreated.url); toast("Link copied."); }} className="btn-primary inline-flex items-center gap-2"><Copy size={14} /> Copy link</button>
            <a
              href={`mailto:${encodeURIComponent(justCreated.email)}?subject=${encodeURIComponent("Your client has shared their PatternProof case file")}&body=${encodeURIComponent(`I've shared my documented case with you through PatternProof.\n\nAccess link (expires in ${days} days):\n${justCreated.url}\n\nYou'll be asked to create a brief attorney account on first use.`)}`}
              className="btn-ghost inline-flex items-center gap-2"
            ><Mail size={14} /> Email to attorney</a>
            <button onClick={() => setJustCreated(null)} className="btn-ghost">Done</button>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            This link expires in {days} days. Your attorney cannot share or download your data without your permission.
          </p>
        </div>
      )}

      <div className="mt-6">
        {!open ? (
          <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2" style={{ background: "#A8CCE0", color: "#1A1714" }}><Plus size={15} /> Invite your attorney</button>
        ) : (
          <div className="card-pp space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label-eyebrow">Attorney email</label>
                <input className="input-pp mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Attorney's name (optional)</label>
                <input className="input-pp mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Law firm (optional)</label>
                <input className="input-pp mt-1" value={firm} onChange={(e) => setFirm(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Expires in</label>
                <select className="input-pp mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {[
                ["Include all logged incidents", incIncidents, setIncIncidents],
                ["Include uploaded evidence",   incEvidence,   setIncEvidence],
                ["Include pattern analysis",    incPatterns,   setIncPatterns],
              ].map(([label, val, set]) => (
                <label key={String(label)} className="flex items-center gap-3 text-[13px]" style={{ color: "var(--foreground)" }}>
                  <input type="checkbox" checked={val as boolean} onChange={(e) => (set as (b: boolean) => void)(e.target.checked)} />
                  {label as string}
                </label>
              ))}
            </div>

            <div>
              <label className="label-eyebrow">Or share a specific date range only (optional)</label>
              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <input className="input-pp" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label="From" />
                <input className="input-pp" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label="To" />
              </div>
            </div>

            <div>
              <label className="label-eyebrow">Personal note to attorney (private, optional)</label>
              <textarea className="input-pp mt-1" rows={3} value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} placeholder="Add a note for your attorney" />
            </div>

            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="btn-primary" style={{ background: "#A8CCE0", color: "#1A1714" }}>{busy ? "Creating…" : "Generate Secure Access Link"}</button>
              <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-serif text-[20px]">Active counsel</h2>
      <div className="mt-3 space-y-2">
        {!data ? <div className="card-pp">Loading…</div> :
         data.links.filter((l) => l.status === "active").length === 0
           ? <div className="card-pp text-[13px]" style={{ color: "var(--muted-foreground)" }}>No attorneys connected yet.</div>
           : data.links.filter((l) => l.status === "active").map((l) => (
              <div key={l.id} className="card-pp flex items-start justify-between gap-3" style={{ borderLeft: "3px solid var(--safe)" }}>
                <div>
                  <div className="flex items-center gap-2"><ShieldCheck size={14} style={{ color: "var(--safe)" }} /><div className="font-serif text-[16px]">{l.profile?.full_name ?? "Attorney"}</div></div>
                  <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {l.profile?.firm_name && `${l.profile.firm_name} · `}{l.profile?.email}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    linked {new Date(l.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMessagingLinkId(l.id)}
                    className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                    style={{ position: "relative" }}
                  >
                    <MessageSquare size={13} /> Message
                    {(unread[l.id] ?? 0) > 0 && (
                      <span style={{
                        marginLeft: 4, background: "var(--primary)", color: "#fff",
                        borderRadius: 999, fontSize: 10, padding: "1px 6px", fontWeight: 600,
                      }}>{unread[l.id]}</span>
                    )}
                  </button>
                  <button onClick={async () => { const ok = await confirm({ title: "Revoke this attorney's access?", body: "The share link will stop working immediately.", confirmLabel: "Revoke", cancelLabel: "Keep" }); if (ok) { await revokeLk({ data: { id: l.id } }); toast("Access revoked."); load(); } }} className="btn-ghost inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--primary)" }}>
                    <Trash2 size={13} /> Revoke
                  </button>
                </div>
              </div>
            ))}
      </div>

      <h2 className="mt-10 font-serif text-[20px]">Pending invitations</h2>
      <div className="mt-3 space-y-2">
        {!data ? null :
         data.invitations.filter((i) => i.status === "pending").length === 0
           ? <div className="card-pp text-[13px]" style={{ color: "var(--muted-foreground)" }}>No pending invitations.</div>
           : data.invitations.filter((i) => i.status === "pending").map((i) => (
              <div key={i.id} className="card-pp flex flex-wrap items-start justify-between gap-3" style={{ borderLeft: "3px solid var(--accent)" }}>
                <div>
                  <div className="flex items-center gap-2"><Scale size={14} /><div className="font-serif text-[16px]">{i.attorney_name ?? i.attorney_email}</div></div>
                  <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{i.attorney_email}</div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {i.expires_at && `expires ${new Date(i.expires_at).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copy(i.invite_token)} className="btn-ghost inline-flex items-center gap-1 text-[12px]"><Copy size={13} /> Copy link</button>
                  <button onClick={async () => { await revokeInv({ data: { id: i.id } }); toast("Invitation revoked."); load(); }} className="btn-ghost inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--primary)" }}><Trash2 size={13} /> Cancel</button>
                </div>
              </div>
            ))}
      </div>
      {messagingLinkId && (
        <MessagePanel
          linkId={messagingLinkId}
          onClose={() => { setMessagingLinkId(null); load(); }}
        />
      )}
      {dialog}
    </div>
  );
}

function MessagePanel({ linkId, onClose }: { linkId: string; onClose: () => void }) {
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markFn = useServerFn(markMessagesRead);
  const [messages, setMessages] = useState<Array<{ id: string; sender_role: string; content: string; created_at: string; read_at: string | null }> | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    listFn({ data: { link_id: linkId } })
      .then((r) => setMessages(r.messages as typeof messages extends null ? never : Exclude<typeof messages, null>))
      .catch(() => setMessages([]));
  }, [listFn, linkId]);

  useEffect(() => {
    load();
    markFn({ data: { link_id: linkId } }).catch(() => {});
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, markFn, linkId]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendFn({ data: { link_id: linkId, content: text } });
      setBody("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send.");
    } finally { setSending(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,12,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div className="card-pp" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="label-eyebrow">Messages</div>
            <div className="font-serif text-[20px] mt-1">Conversation with your attorney</div>
          </div>
          <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", marginTop: 12, display: "grid", gap: 8, padding: 4 }}>
          {messages === null && <div className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>Loading…</div>}
          {messages?.length === 0 && <div className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>No messages yet.</div>}
          {messages?.map((m) => {
            const mine = m.sender_role === "survivor";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 10, background: mine ? "#A8CCE0" : "var(--input)", color: "#1A1714" }}>
                  <div className="text-[13px]" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</div>
                  <div className="text-[10px] mt-1" style={{ opacity: 0.7, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{mine ? "You" : "Attorney"}</span>
                    <span>
                      {new Date(m.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {mine && (m.read_at ? " · Read" : " · Sent")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          <textarea className="input-pp" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message to your attorney…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>⌘/Ctrl + Enter to send · Do not use for evidence.</span>
            <button className="btn-primary inline-flex items-center gap-1" style={{ background: "#A8CCE0", color: "#1A1714" }} onClick={submit} disabled={sending || !body.trim()}>
              <Send size={13} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}