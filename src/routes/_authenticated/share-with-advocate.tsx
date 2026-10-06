import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Trash2, HeartHandshake, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  createAdvocateInvitation,
  listMyAdvocateAccess,
  revokeAdvocateInvitation,
  revokeAdvocateLink,
} from "@/lib/advocate.functions";
import {
  downloadMyAdvocatePacket,
  previewAdvocateScope,
  setAdvocateOrgVisibility,
} from "@/lib/advocate-packet.functions";
import { downloadBase64 } from "@/lib/download-base64";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";
import { PrivateSinceSharing } from "@/components/sharing/PrivateSinceSharing";
import { SharePreview, type SharePreviewStatus } from "@/components/sharing/SharePreview";
import type { ShareMergeMode } from "@/lib/sharing/merge-share-scope";

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
  const packetFn = useServerFn(downloadMyAdvocatePacket);
  const previewFn = useServerFn(previewAdvocateScope);
  const orgVisibilityFn = useServerFn(setAdvocateOrgVisibility);
  const [busyLink, setBusyLink] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    data: Awaited<ReturnType<typeof previewAdvocateScope>>;
  } | null>(null);

  const [data, setData] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [note, setNote] = useState("");
  // Scope starts off. Nothing is shared until you turn it on here.
  const [incIncidents, setIncIncidents] = useState(false);
  const [incEvidence, setIncEvidence] = useState(false);
  const [incPatterns, setIncPatterns] = useState(false);
  const [days, setDays] = useState(30);
  const [caseId, setCaseId] = useState("");
  const [cases, setCases] = useState<
    Array<{ id: string; case_name: string | null; other_party: string | null }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<{
    url: string;
    email: string;
    shared?: { incidents: number; files: number };
    heldBack?: number;
  } | null>(null);
  const [previewStatus, setPreviewStatus] = useState<SharePreviewStatus>({ kind: "idle" });
  const [mergeMode, setMergeMode] = useState<ShareMergeMode | null>(null);

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

  const existingLinkForEmail = (() => {
    const want = email.trim().toLowerCase();
    if (!want || !data) return null;
    return (
      (data.links ?? []).find(
        (l) => l.status === "active" && (l.profile?.email ?? "").toLowerCase() === want,
      ) ?? null
    );
  })();

  useEffect(() => {
    setMergeMode(null);
  }, [existingLinkForEmail?.id, email]);

  const submit = async () => {
    if (!email.trim()) {
      toast("Add the advocate's email first.");
      return;
    }
    if (!incIncidents && !incEvidence && !incPatterns && !caseId) {
      toast("Choose at least one thing to share before sending this invite.");
      return;
    }
    const needsItemPreview = incIncidents || incEvidence || !!caseId || !!existingLinkForEmail;
    if (needsItemPreview && previewStatus.kind !== "ok") {
      toast(
        previewStatus.kind === "error"
          ? "We couldn't verify what this would share. Fix the preview before creating a link."
          : "Review what they'll receive before creating the link.",
      );
      return;
    }
    if (existingLinkForEmail && !mergeMode) {
      toast("Choose Add items or Replace what's shared before creating this link.");
      return;
    }
    setBusy(true);
    try {
      const verified = previewStatus.kind === "ok" ? previewStatus.preview : null;
      const { invitation, shared, excluded } = await createFn({
        data: {
          advocate_email: email.trim(),
          advocate_name: name.trim() || undefined,
          org_name: org.trim() || undefined,
          personal_note: note.trim() || undefined,
          include_all_incidents: verified ? false : incIncidents,
          include_all_evidence: verified ? false : incEvidence,
          scope_incidents: verified?.scope_incidents,
          scope_evidence: verified?.scope_evidence,
          include_patterns: incPatterns,
          expires_days: days,
          case_id: caseId || null,
        },
      });
      const url = `${window.location.origin}/advocate-invite/${invitation.invite_token}`;
      setJustCreated({ url, email: email.trim(), shared, heldBack: excluded?.length ?? 0 });
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
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted-foreground)", maxWidth: 640, marginTop: 8 }}>
        Advocates and organization staff are not necessarily lawyers, and their confidentiality
        obligations vary. Anything downloaded stays on their computer — withdrawing access stops
        future access but can't reach copies already saved.
      </p>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted-foreground)", maxWidth: 640, marginTop: 8 }}>
        What you share is fixed at the moment you share it. Anything you add later stays private
        until you choose to add it.
      </p>

      <PrivateSinceSharing kind="advocate" />


      {justCreated && (
        <div
          className="card-pp"
          style={{ padding: 16, marginTop: 16, borderLeft: "3px solid var(--pp-accent-org)" }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Invite link for {justCreated.email}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
            Send this to them however feels safest. Only that email address can open it.
          </p>
          {justCreated.shared && (
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
              Shared: {justCreated.shared.incidents} {justCreated.shared.incidents === 1 ? "entry" : "entries"} and{" "}
              {justCreated.shared.files} {justCreated.shared.files === 1 ? "file" : "files"}.
              {justCreated.heldBack ? ` ${justCreated.heldBack} you picked were left out (private or undecided).` : ""}
            </p>
          )}
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
          {existingLinkForEmail && (
            <div
              className="rounded-2xl p-3 text-[13px]"
              style={{ background: "var(--input)" }}
              data-testid="share-merge-mode"
            >
              <p className="font-semibold">
                {existingLinkForEmail.profile?.full_name ?? "This advocate"} already has access.
              </p>
              <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>
                Choose Add items or Replace what&apos;s shared, then review the preview. Ending
                access is a separate action from changing readiness for future invitations.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="advocate-merge-mode"
                    checked={mergeMode === "add"}
                    onChange={() => setMergeMode("add")}
                  />
                  Add items
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="advocate-merge-mode"
                    checked={mergeMode === "replace"}
                    onChange={() => setMergeMode("replace")}
                  />
                  Replace what&apos;s shared
                </label>
              </div>
            </div>
          )}
          <SharePreview
            includeIncidents={incIncidents}
            includeEvidence={incEvidence}
            caseId={caseId}
            existingLinkId={existingLinkForEmail?.id ?? null}
            mergeMode={existingLinkForEmail ? mergeMode : null}
            linkKind="advocate"
            onStatusChange={setPreviewStatus}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              disabled={
                busy ||
                ((incIncidents || incEvidence || !!caseId || !!existingLinkForEmail) &&
                  previewStatus.kind !== "ok") ||
                !(incIncidents || incEvidence || incPatterns || caseId) ||
                (!!existingLinkForEmail && !mergeMode)
              }
              className="btn-pp"
              data-testid="generate-advocate-link"
            >
              {busy
                ? "Creating…"
                : previewStatus.kind === "loading"
                  ? "Checking preview…"
                  : previewStatus.kind === "error"
                    ? "Preview failed — try again"
                    : "Create invite link"}
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

                {!revoked && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                      disabled={busyLink === l.id}
                      onClick={async () => {
                        setBusyLink(l.id);
                        try {
                          downloadBase64(await packetFn({ data: { link_id: l.id } }));
                          toast("Packet downloaded.");
                        } catch (e) {
                          toast(
                            e instanceof Error
                              ? e.message
                              : "We couldn't build that packet. Try again in a moment.",
                          );
                        } finally {
                          setBusyLink(null);
                        }
                      }}
                    >
                      <Download size={13} />{" "}
                      {busyLink === l.id ? "Preparing…" : "Download advocate packet"}
                    </button>
                    <button
                      className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                      onClick={async () => {
                        try {
                          const data = await previewFn({ data: { link_id: l.id } });
                          setPreview({ id: l.id, data });
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "We couldn't open that preview.");
                        }
                      }}
                    >
                      <Eye size={13} /> Preview what they can see
                    </button>
                    <label style={{ fontSize: 12, display: "inline-flex", gap: 6 }}>
                      <input
                        type="checkbox"
                        defaultChecked={!!l.org_admin_visibility}
                        onChange={async (e) => {
                          try {
                            await orgVisibilityFn({
                              data: { link_id: l.id, enabled: e.target.checked },
                            });
                            toast(
                              e.target.checked
                                ? "Their organization can now see your case label."
                                : "Organization visibility turned off.",
                            );
                            load();
                          } catch {
                            toast("We couldn't change that just now.");
                          }
                        }}
                      />
                      Let their organization see this case label
                    </label>
                  </div>
                )}

                {preview?.id === l.id && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 12,
                      background: "var(--input)",
                      fontSize: 12.5,
                    }}
                  >
                    {preview.data.active ? (
                      <>
                        <div style={{ fontWeight: 700 }}>
                          They can currently open {preview.data.incidents.length} journal{" "}
                          {preview.data.incidents.length === 1 ? "entry" : "entries"} and{" "}
                          {preview.data.evidence.length} evidence{" "}
                          {preview.data.evidence.length === 1 ? "item" : "items"}.
                        </div>
                        <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                          {preview.data.evidence.slice(0, 8).map((e) => (
                            <li key={e.id}>
                              {e.date ?? "Undated"} — {e.title}
                            </li>
                          ))}
                        </ul>
                        <p style={{ marginTop: 6, color: "var(--muted-foreground)" }}>
                          This list comes from the same check the advocate's own view uses.
                        </p>
                      </>
                    ) : (
                      <span>Nothing is open to them on this link right now.</span>
                    )}
                    <button
                      className="btn-ghost text-[12px]"
                      style={{ marginTop: 6 }}
                      onClick={() => setPreview(null)}
                    >
                      Close
                    </button>
                  </div>
                )}
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
