import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Copy, Link2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/attorney-portal")({
  component: AttorneyPortal,
});

interface AccessRow {
  id: string;
  attorney_name: string;
  attorney_email: string;
  attorney_type: string;
  access_level: string;
  access_token: string;
  expires_at: string | null;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  shared_incident_ids: string[];
  shared_evidence_ids: string[];
}

function AttorneyPortal() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("attorney");
  const [level, setLevel] = useState("full");
  const [expiresDays, setExpiresDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("attorney_access").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRows((data as AccessRow[] | null) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!user || !name.trim() || !email.trim()) { toast("Add a name and email first."); return; }
    setBusy(true);
    const [{ data: incs }, { data: evs }] = await Promise.all([
      supabase.from("incidents").select("id").eq("user_id", user.id),
      supabase.from("evidence").select("id").eq("user_id", user.id),
    ]);
    const expires = expiresDays > 0
      ? new Date(Date.now() + expiresDays * 86400000).toISOString()
      : null;
    const { error } = await supabase.from("attorney_access").insert({
      user_id: user.id,
      attorney_name: name.trim(),
      attorney_email: email.trim(),
      attorney_type: type,
      access_level: level,
      expires_at: expires,
      shared_incident_ids: (incs ?? []).map((r) => r.id),
      shared_evidence_ids: (evs ?? []).map((r) => r.id),
      include_escalation: true,
    });
    setBusy(false);
    if (error) { toast("We couldn't create that link. Try again in a moment."); return; }
    toast("Access link created. Share it only with someone you trust.");
    setName(""); setEmail(""); setOpen(false);
    load();
  };

  const revoke = async (id: string) => {
    if (!user) return;
    if (!confirm("Revoke this access? The link will stop working.")) return;
    await supabase.from("attorney_access").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    toast("Access revoked.");
    load();
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/attorney/${token}`;
    await navigator.clipboard.writeText(url);
    toast("Link copied. Paste it into a secure message.");
  };

  return (
    <div>
      <div className="label-eyebrow">Attorney portal</div>
      <h1 className="mt-2 font-serif text-[34px] leading-tight">
        Share with the <em>right people, safely.</em>
      </h1>
      <p className="mt-2 max-w-2xl text-[14px]" style={{ color: "var(--muted-foreground)" }}>
        Generate a private, read-only link to your records. Revoke any link at any time — nothing is ever shared publicly.
      </p>

      <div className="mt-6">
        {!open ? (
          <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={15} /> Create access link</button>
        ) : (
          <div className="card-pp space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label-eyebrow">Their name</label>
                <input className="input-pp mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Their email</label>
                <input className="input-pp mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label-eyebrow">Role</label>
                <select className="input-pp mt-1" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="attorney">Attorney</option>
                  <option value="advocate">Advocate</option>
                  <option value="paralegal">Paralegal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow">Access</label>
                <select className="input-pp mt-1" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="full">Full (everything)</option>
                  <option value="summary">Summary only</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow">Expires in</label>
                <select className="input-pp mt-1" value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never (until I revoke)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={create} disabled={busy} className="btn-primary">{busy ? "Creating…" : "Create link"}</button>
              <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {rows.length === 0 ? (
          <div className="card-pp">
            <div className="flex items-center gap-2"><Briefcase size={16} /><div className="font-serif text-[16px]">No links shared yet</div></div>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted-foreground)" }}>When you're ready, you can grant someone temporary access to your records here.</p>
          </div>
        ) : rows.map((r) => {
          const revoked = !!r.revoked_at;
          const expired = r.expires_at && new Date(r.expires_at) < new Date();
          return (
            <div key={r.id} className="card-pp" style={{ borderLeft: `3px solid ${revoked || expired ? "var(--muted-foreground)" : "var(--accent)"}` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-serif text-[17px]">{r.attorney_name}</div>
                  <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {r.attorney_email} · {r.attorney_type} · {r.access_level}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {r.shared_incident_ids.length} incident{r.shared_incident_ids.length === 1 ? "" : "s"} · {r.shared_evidence_ids.length} evidence file{r.shared_evidence_ids.length === 1 ? "" : "s"}
                    {r.expires_at && ` · expires ${new Date(r.expires_at).toLocaleDateString()}`}
                    {r.last_accessed_at && ` · last opened ${new Date(r.last_accessed_at).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {revoked ? (
                    <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--input)" }}>Revoked</span>
                  ) : expired ? (
                    <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--input)" }}>Expired</span>
                  ) : (
                    <>
                      <button onClick={() => copyLink(r.access_token)} className="btn-ghost inline-flex items-center gap-1 text-[12px]"><Link2 size={13} /> Copy link</button>
                      <button onClick={() => copyLink(r.access_token)} className="btn-ghost inline-flex items-center gap-1 text-[12px]"><Copy size={13} /> Copy token</button>
                      <button onClick={() => revoke(r.id)} className="btn-ghost inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--primary)" }}><Trash2 size={13} /> Revoke</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}