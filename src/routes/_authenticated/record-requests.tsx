import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/pp";
import { HubTabs, CASE_TABS } from "@/components/HubTabs";
import { RequestResponsePanel } from "@/components/survivor/RequestResponsePanel";
import { listMyRecordRequests, revokeConsentGrant } from "@/lib/record-requests.functions";

export const Route = createFileRoute("/_authenticated/record-requests")({
  head: () => ({
    meta: [
      { title: "PatternProof — Requests for your records" },
      { name: "description", content: "Review who has asked for your records, decide what to share, and withdraw access at any time." },
      { property: "og:title", content: "PatternProof — Requests for your records" },
      { property: "og:description", content: "Review who has asked for your records, decide what to share, and withdraw access at any time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RecordRequestsPage,
});

type Data = Awaited<ReturnType<typeof listMyRecordRequests>>;

const STATUS_LABEL: Record<string, string> = {
  pending_survivor: "Waiting on you",
  approved: "You approved this",
  modified: "You approved part of this",
  declined: "You declined",
  expired: "Ended",
  revoked: "You withdrew this",
  cancelled: "Withdrawn by them",
};

function RecordRequestsPage() {
  const listFn = useServerFn(listMyRecordRequests);
  const revokeFn = useServerFn(revokeConsentGrant);
  const [data, setData] = useState<Data | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    listFn().then(setData).catch(() => setData(null));
  }, [listFn]);
  useEffect(() => { load(); }, [load]);

  const pending = data?.requests.filter((r) => r.status === "pending_survivor") ?? [];
  const past = data?.requests.filter((r) => r.status !== "pending_survivor") ?? [];
  const grants = data?.grants ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <HubTabs tabs={CASE_TABS} />
      <PageHeader
        title="Requests for your records"
        description="Nothing leaves your account unless you say yes here. You can share part of a request, or none of it, and you can withdraw later."
      />

      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        Waiting on you
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Nothing here right now — if an organization asks for records, it will appear here first.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {pending.map((r) => (
            <div key={r.id} className="pp-card p-4">
              <p className="text-[14.5px] font-semibold">{r.requester_label} asked for records</p>
              <p className="mt-2 text-[14px]">{r.purpose}</p>
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                {r.scope_summary}
              </p>
              <button
                type="button"
                className="btn-ghost mt-3 text-[13px]"
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
              >
                {openId === r.id ? "Close" : "Decide what to share"}
              </button>
              {openId === r.id ? (
                <RequestResponsePanel request={r} onDone={() => { setOpenId(null); load(); }} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        What's shared right now
      </h2>
      {grants.length === 0 ? (
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
          Nothing is shared through a request right now.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {grants.map((g) => (
            <div key={g.id} className="pp-card p-4">
              <p className="text-[14.5px] font-semibold">{g.recipient_label}</p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                {g.status === "active" ? "In force" : g.status === "revoked" ? "Withdrawn" : "Ended"} ·
                started {new Date(g.effective_at).toLocaleDateString()}
                {g.expires_at ? ` · ends ${new Date(g.expires_at).toLocaleDateString()}` : ""}
              </p>
              <p className="mt-2 text-[13px]">{g.scope_summary}</p>
              {g.status === "active" ? (
                <button
                  type="button"
                  className="btn-ghost mt-3 text-[13px]"
                  onClick={async () => {
                    try { await revokeFn({ data: { id: g.id } }); toast("Withdrawn. They can't open it again."); load(); }
                    catch { toast("We couldn't withdraw that. Try again in a moment."); }
                  }}
                >
                  Withdraw access
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
        Earlier requests
      </h2>
      {past.length === 0 ? (
        <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>Nothing yet.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {past.map((r) => (
            <div key={r.id} className="pp-card p-3">
              <p className="text-[13.5px]">
                <strong>{r.requester_label}</strong> — {STATUS_LABEL[r.status] ?? r.status}
              </p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                {new Date(r.created_at).toLocaleDateString()} · {r.purpose}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
