import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { Copy, Plus, Scale, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createInvitation, listMyInvitations, revokeInvitation, revokeLink } from "@/lib/attorney-invitations.functions";

export const Route = createFileRoute("/_authenticated/share-with-attorney")({
  component: ShareWithAttorney,
});

type Listing = Awaited<ReturnType<typeof listMyInvitations>>;

function ShareWithAttorney() {
  const list = useServerFn(listMyInvitations);
  const create = useServerFn(createInvitation);
  const revokeInv = useServerFn(revokeInvitation);
  const revokeLk = useServerFn(revokeLink);

  const [data, setData] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { list().then(setData); }, [list]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!email.trim()) { toast("Add an email."); return; }
    setBusy(true);
    try {
      const r = await create({ data: {
        attorney_email: email.trim(),
        attorney_name: name.trim() || undefined,
        include_all_incidents: true,
        include_all_evidence: true,
        include_patterns: true,
        expires_days: days,
      } });
      const url = `${window.location.origin}/accept-invite/${r.invitation.invite_token}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast("Invitation link copied to clipboard.");
      setEmail(""); setName(""); setOpen(false);
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
      <h1 className="mt-2 font-serif text-[30px]">Invite your attorney to <em>full case access</em></h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Your attorney gets a live, read-only litigation portal — every incident, pattern, and evidence file — instead of a static export.
      </p>

      <div className="mt-6">
        {!open ? (
          <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={15} /> Invite an attorney</button>
        ) : (
          <div className="card-pp space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label-eyebrow">Attorney email</label>
                <input className="input-pp mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Their name (optional)</label>
                <input className="input-pp mt-1" value={name} onChange={(e) => setName(e.target.value)} />
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
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="btn-primary">{busy ? "Creating…" : "Create & copy link"}</button>
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
                <button onClick={async () => { if (confirm("Revoke this attorney's access?")) { await revokeLk({ data: { id: l.id } }); toast("Access revoked."); load(); } }} className="btn-ghost inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--primary)" }}>
                  <Trash2 size={13} /> Revoke
                </button>
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
    </div>
  );
}