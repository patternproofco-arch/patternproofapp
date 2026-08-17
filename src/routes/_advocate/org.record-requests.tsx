import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { listOrgRecordRequests, cancelRecordRequest } from "@/lib/record-requests.functions";
import { RecordRequestForm } from "@/components/org/RecordRequestForm";
import { GrantedRecords } from "@/components/org/GrantedRecords";

export const Route = createFileRoute("/_advocate/org/record-requests")({
  component: RecordRequests,
});

type Data = Awaited<ReturnType<typeof listOrgRecordRequests>>;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_survivor: "Waiting on their answer",
  approved: "Approved",
  modified: "Approved with changes",
  declined: "Declined",
  expired: "Ended",
  revoked: "Withdrawn",
  cancelled: "Cancelled",
};

function RecordRequests() {
  const listFn = useServerFn(listOrgRecordRequests);
  const cancelFn = useServerFn(cancelRecordRequest);
  const [data, setData] = useState<Data | null>(null);
  const [composing, setComposing] = useState(false);
  const [openGrant, setOpenGrant] = useState<string | null>(null);

  const load = useCallback(() => {
    listFn().then(setData).catch(() => setData(null));
  }, [listFn]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <p className="orgx-eyebrow">Records</p>
      <h1 style={{ margin: "8px 0 10px" }}>Record requests</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 640 }}>
        A record request asks one person for one specific set of records. They decide whether to
        approve it as asked, narrow it, or decline — and they can withdraw later. A referral on its
        own never opens anything.
      </p>

      {!data ? (
        <p className="orgx-muted" style={{ fontSize: 13.5, marginTop: 22 }}>Opening…</p>
      ) : (
        <>
          {composing ? (
            <RecordRequestForm
              connections={data.connections}
              onCreated={() => { setComposing(false); load(); }}
              onCancel={() => setComposing(false)}
            />
          ) : data.connections.length === 0 ? (
            <div className="orgx-empty" style={{ marginTop: 22 }}>
              Nothing here yet — you can send a request once someone has connected their workspace
              with your organization.
            </div>
          ) : (
            <button type="button" className="orgx-btn" style={{ marginTop: 20 }} onClick={() => setComposing(true)}>
              <Plus size={15} aria-hidden /> New request
            </button>
          )}

          <h2 className="orgx-eyebrow" style={{ margin: "32px 0 12px" }}>Requests you've sent</h2>
          {data.requests.length === 0 ? (
            <div className="orgx-empty">Nothing sent yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.requests.map((r) => (
                <div key={r.id} className="orgx-card">
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="orgx-chip"
                      data-tone={r.status === "approved" || r.status === "modified" ? "active"
                        : r.status === "pending_survivor" ? "attention" : "ended"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="orgx-muted" style={{ fontSize: 12.5 }}>
                      Sent {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 14 }}>{r.purpose}</p>
                  <p className="orgx-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>{r.scope_summary}</p>
                  {r.survivor_note ? (
                    <p className="orgx-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
                      Their note: {r.survivor_note}
                    </p>
                  ) : null}
                  {r.status === "pending_survivor" ? (
                    <button type="button" className="orgx-btn orgx-btn-quiet"
                      style={{ marginTop: 12, minHeight: 32, padding: "5px 10px", fontSize: 12.5 }}
                      onClick={async () => {
                        try { await cancelFn({ data: { id: r.id } }); toast("Request withdrawn."); load(); }
                        catch { toast("We couldn't withdraw that. Try again in a moment."); }
                      }}>
                      Withdraw request
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <h2 className="orgx-eyebrow" style={{ margin: "32px 0 12px" }}>What you can open</h2>
          {data.grants.length === 0 ? (
            <div className="orgx-empty">
              Nothing yet — approved requests appear here, and only while they're in force.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.grants.map((g) => {
                const live = g.status === "active";
                return (
                  <div key={g.id} className="orgx-card">
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="orgx-chip" data-tone={live ? "active" : "ended"}>
                        {live ? "In force" : g.status === "revoked" ? "Withdrawn" : "Ended"}
                      </span>
                      <span className="orgx-muted" style={{ fontSize: 12.5 }}>
                        Since {new Date(g.effective_at).toLocaleDateString()}
                        {g.expires_at ? ` · ends ${new Date(g.expires_at).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    <p className="orgx-muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>{g.scope_summary}</p>
                    {live ? (
                      <button type="button" className="orgx-btn orgx-btn-quiet"
                        style={{ marginTop: 12, minHeight: 32, padding: "5px 10px", fontSize: 12.5 }}
                        onClick={() => setOpenGrant(openGrant === g.id ? null : g.id)}>
                        {openGrant === g.id ? "Close" : "Open shared records"}
                      </button>
                    ) : null}
                    {live && openGrant === g.id ? <GrantedRecords grantId={g.id} /> : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
