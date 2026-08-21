import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Trash2, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import {
  createAdvocateInvitation,
  listMyAdvocateAccess,
  revokeAdvocateInvitation,
  revokeAdvocateLink,
} from "@/lib/advocate.functions";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";

export const Route = createFileRoute("/_authenticated/share-with-advocate")({
  component: ShareWithAdvocate,
});

type Listing = Awaited<ReturnType<typeof listMyAdvocateAccess>>;

function ShareWithAdvocate() {
  const { user } = useAuth();
  const { confirm, dialog } = useConfirm();
  const listFn = useServerFn(listMyAdvocateAccess);
  const createFn = useServerFn(createAdvocateInvitation);
  const revokeInvFn = useServerFn(revokeAdvocateInvitation);
  const revokeLinkFn = useServerFn(revokeAdvocateLink);

  const [data, setData] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [note, setNote] = useState("");
  const [incIncidents, setIncIncidents] = useState(true);
  const [incEvidence, setIncEvidence] = useState(true);
  const [incPatterns, setIncPatterns] = useState(true);
  const [days, setDays] = useState(30);
  const [caseId, setCaseId] = useState("");
  const [cases, setCases] = useState<
    Array<{ id: string; case_name: string | null; other_party: string | null }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<{ url: string; email: string } | null>(null);

  const load = useCallback(() => {
    listFn()
      .then(setData)
      .catch(() => setData(null));
  }, [listFn]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("cases")
      .select("id,case_name,other_party")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setCases((data ?? []) as typeof cases));
  }, [user]);

  const submit = async () => {
    if (!email.trim()) {
      toast("Add the advocate's email first.");
      return;
    }
    setBusy(true);
    try {
      const { invitation } = await createFn({
        data: {
          advocate_email: email.trim(),
          advocate_name: name.trim() || undefined,
          org_name: org.trim() || undefined,
          personal_note: note.trim() || undefined,
          include_all_incidents: incIncidents,
          include_all_evidence: incEvidence,
          include_patterns: incPatterns,
          expires_days: days,
          case_id: caseId || null,
        },
      });
      const url = `${window.location.origin}/advocate-invite/${invitation.invite_token}`;
      setJustCreated({ url, email: email.trim() });
      setOpen(false);
      setEmail("");
      setName("");
      setOrg("");
      setNote("");
      toast("Saved. Your invite link is ready.");
      load();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "We couldn't create that invite. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const pending = (data?.invitations ?? []).filter((i) => i.status === "pending");
  const links = data?.links ?? [];

  return (
    <div>
      {dialog}
      <HubTabs tabs={CASE_TABS} />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Share with an advocate</h1>
      <p
        style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted-foreground)", maxWidth: 640 }}
      >
        If someone at a domestic violence organization is helping you, you can give them a read-only
        view of what you've documented. They can't change or delete anything, and you can withdraw
        access whenever you want.
      </p>

      {justCreated && (
        <div
          className="card-pp"
          style={{ padding: 16, marginTop: 16, borderLeft: "3px solid var(--pp-accent-org)" }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Invite link for {justCreated.email}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
            Send this to them however feels safest. Only that email address can open it.
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                fontSize: 11.5,
                wordBreak: "break-all",
                background: "var(--input)",
                padding: "6px 8px",
                borderRadius: 18,
              }}
            >
              {justCreated.url}
            </code>
            <button
              className="btn-ghost inline-flex items-center gap-1 text-[12px]"
              onClick={() => {
                navigator.clipboard.writeText(justCreated.url);
                toast("Copied.");
              }}
            >
              <Copy size={13} /> Copy
            </button>
          </div>
        </div>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="btn-pp inline-flex items-center gap-2"
          style={{ marginTop: 18 }}
        >
          <Plus size={14} /> Invite an advocate
        </button>
      ) : (
        <div
          className="card-pp"
          style={{ padding: 18, marginTop: 18, display: "grid", gap: 10, maxWidth: 560 }}
        >
          <label style={{ fontSize: 12.5 }}>
            Their email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-pp"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12.5 }}>
            Their name (optional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-pp"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12.5 }}>
            Organization (optional)
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className="input-pp"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 12.5 }}>
            A note for them (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-pp"
              style={{ width: "100%", marginTop: 4, minHeight: 70 }}
            />
          </label>
          {cases.length > 0 && (
            <label style={{ fontSize: 12.5 }}>
              Which case
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="input-pp"
                style={{ width: "100%", marginTop: 4 }}
              >
                <option value="">Everything I've documented</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_name?.trim() || c.other_party?.trim() || "Case"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <label>
              <input
                type="checkbox"
                checked={incIncidents}
                onChange={(e) => setIncIncidents(e.target.checked)}
              />{" "}
              Share my journal entries
            </label>
            <label>
              <input
                type="checkbox"
                checked={incEvidence}
                onChange={(e) => setIncEvidence(e.target.checked)}
              />{" "}
              Share my evidence list
            </label>
            <label>
              <input
                type="checkbox"
                checked={incPatterns}
                onChange={(e) => setIncPatterns(e.target.checked)}
              />{" "}
              Share pattern grouping
            </label>
          </div>
          <label style={{ fontSize: 12.5 }}>
            Link expires in
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="input-pp"
              style={{ width: "100%", marginTop: 4 }}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submit} disabled={busy} className="btn-pp">
              {busy ? "Creating…" : "Create invite link"}
            </button>
            <button onClick={() => setOpen(false)} className="btn-ghost text-[13px]">
              Cancel
            </button>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 30, marginBottom: 10 }}>
        Who has access
      </h2>
      {links.length === 0 && pending.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
          No advocate has access yet — when you're ready, this is where you'll see and control it.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {links.map((l) => {
            const revoked = l.status !== "active";
            return (
              <div
                key={l.id}
                className="card-pp"
                style={{
                  padding: 16,
                  borderLeft: `3px solid ${revoked ? "var(--muted-foreground)" : "var(--pp-accent-org)"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <HeartHandshake size={14} />
                      {l.profile?.full_name ?? l.grant.invited_email ?? "Advocate"}
                      {l.profile?.org_name || l.grant.org_name
                        ? ` · ${l.profile?.org_name ?? l.grant.org_name}`
                        : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {l.case_label ? `${l.case_label} · ` : ""}
                      Access since {new Date(l.grant.granted_at).toLocaleDateString()}
                      {l.grant.expires_at
                        ? ` · expires ${new Date(l.grant.expires_at).toLocaleDateString()}`
                        : ""}
                      {revoked && l.revoked_at
                        ? ` · withdrawn ${new Date(l.revoked_at).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  {revoked ? (
                    <span
                      className="rounded-2xl px-3 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--input)" }}
                    >
                      Access withdrawn
                    </span>
                  ) : (
                    <button
                      className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                      style={{ color: "var(--primary)" }}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Withdraw this advocate's access?",
                          body: "They'll lose access immediately — the link stops working and they can't open your records again. One thing to know: anything they already downloaded or printed stays on their computer. Withdrawing can't reach what has already left PatternProof.",
                          confirmLabel: "Withdraw access",
                          cancelLabel: "Keep",
                        });
                        if (!ok) return;
                        await revokeLinkFn({ data: { id: l.id } });
                        toast("Access withdrawn.");
                        load();
                      }}
                    >
                      <Trash2 size={13} /> Withdraw
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {pending.map((i) => (
            <div
              key={i.id}
              className="card-pp"
              style={{ padding: 16, borderLeft: "3px dashed var(--pp-accent-org)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{i.advocate_email}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                    Invited {new Date(i.created_at).toLocaleDateString()} · not opened yet
                    {i.case_label ? ` · ${i.case_label}` : ""}
                  </div>
                </div>
                <button
                  className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                  style={{ color: "var(--primary)" }}
                  onClick={async () => {
                    await revokeInvFn({ data: { id: i.id } });
                    toast("Invite cancelled.");
                    load();
                  }}
                >
                  <Trash2 size={13} /> Cancel invite
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
