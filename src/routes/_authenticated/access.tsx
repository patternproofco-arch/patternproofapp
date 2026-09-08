import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listMyAdvocateAccess, revokeAdvocateLink } from "@/lib/advocate.functions";
import { previewAdvocateScope, downloadMyAdvocatePacket } from "@/lib/advocate-packet.functions";
import { listMyAccessAudit, listPendingAdvocateInvitesForMe } from "@/lib/survivor-access.functions";
import { downloadBase64 } from "@/lib/download-base64";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({
    meta: [
      { title: "Who can see this — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccessPage,
});

function labelEvent(type: string) {
  switch (type) {
    case "case.viewed_by_professional":
      return "A professional viewed a case";
    case "evidence.downloaded_by_professional":
      return "A professional downloaded evidence";
    case "packet.downloaded_by_survivor":
      return "You downloaded a packet";
    case "advocate_access_granted":
      return "Advocate access granted";
    case "advocate_access_revoked":
      return "Advocate access revoked";
    case "org_admin.viewed_assignment_metadata":
      return "An organization admin viewed assignment metadata";
    case "export.attorney_packet":
      return "An attorney packet was exported";
    default:
      return type;
  }
}

function AccessPage() {
  const pendingFn = useServerFn(listPendingAdvocateInvitesForMe);
  const listFn = useServerFn(listMyAdvocateAccess);
  const revokeFn = useServerFn(revokeAdvocateLink);
  const previewFn = useServerFn(previewAdvocateScope);
  const packetFn = useServerFn(downloadMyAdvocatePacket);
  const auditFn = useServerFn(listMyAccessAudit);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof listPendingAdvocateInvitesForMe>>["invites"]>([]);
  const [grants, setGrants] = useState<Awaited<ReturnType<typeof listMyAdvocateAccess>> | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof listMyAccessAudit>>["events"]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const load = useCallback(() => {
    pendingFn().then((r) => setPending(r.invites)).catch(() => setPending([]));
    listFn().then(setGrants).catch(() => setGrants(null));
    auditFn().then((r) => setAudit(r.events)).catch(() => setAudit([]));
  }, [pendingFn, listFn, auditFn]);
  useEffect(load, [load]);
  const activeLinks = (grants?.links ?? []).filter((link) => link.status === "active");
  return (
    <div style={{ display: "grid", gap: 22, maxWidth: 720, padding: "8px 0 48px" }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>Who can see this</h1>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
          Pending invites, active grants, and a log of professional views. Opening an invite never shares by itself. Revoking stops new access inside PatternProof — it cannot retract a copy already downloaded.
        </p>
      </div>
      <section className="card-pp" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: 0 }}>Pending invites</h2>
        {pending.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No pending advocate invites on this email.</p>
        ) : (
          pending.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{i.advocate_name || "An advocate"}{i.org_name ? ` · ${i.org_name}` : ""}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Expires {i.expires_at ? new Date(i.expires_at).toLocaleDateString() : "soon"}</div>
              </div>
              <Link to="/advocate-survivor-invite/$token" params={{ token: i.token }}>Review</Link>
            </div>
          ))
        )}
      </section>
      <section className="card-pp" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: 0 }}>Active grants</h2>
        <p style={{ fontSize: 13 }}>Attorney sharing lives in <Link to="/share-with-attorney">Share with an attorney</Link>{" · "}<Link to="/share-with-advocate">Share with an advocate</Link>.</p>
        {activeLinks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No active advocate grants.</p>
        ) : (
          activeLinks.map((link) => (
            <div key={link.id} style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 600 }}>{link.profile?.full_name || "Advocate"}{link.profile?.org_name ? ` · ${link.profile.org_name}` : ""}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={async () => {
                  try {
                    const result = await previewFn({ data: { link_id: link.id } });
                    if (!result.active) { setPreview("This grant is no longer active, so there is nothing to preview."); return; }
                    setPreview(`${result.incidents.length} timeline entries and ${result.evidence.length} evidence files are in scope${result.grant?.include_patterns ? ", including Recurline" : ""}.`);
                  } catch { toast("We couldn't preview that grant."); }
                }}>Preview</button>
                <button type="button" onClick={async () => {
                  try {
                    const file = await packetFn({ data: { link_id: link.id } });
                    downloadBase64({ filename: file.filename, content_type: file.content_type ?? "application/pdf", base64: file.base64 });
                    toast("Packet downloaded. A copy that has left PatternProof cannot be retracted.");
                  } catch { toast("We couldn't build that packet."); }
                }}>Download packet</button>
                <button type="button" onClick={async () => {
                  try { await revokeFn({ data: { id: link.id } }); toast("Access revoked for future views."); load(); }
                  catch { toast("We couldn't revoke that grant."); }
                }}>Revoke</button>
              </div>
            </div>
          ))
        )}
        {preview ? <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{preview}</p> : null}
      </section>
      <section className="card-pp" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, margin: 0 }}>Who viewed what</h2>
        {audit.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No recorded professional views yet.</p>
        ) : (
          audit.map((e) => (
            <div key={e.id} style={{ fontSize: 13 }}>{new Date(e.created_at).toLocaleString()} · {labelEvent(e.event_type)}{e.actor_kind ? ` · ${e.actor_kind}` : ""}</div>
          ))
        )}
      </section>
    </div>
  );
}
