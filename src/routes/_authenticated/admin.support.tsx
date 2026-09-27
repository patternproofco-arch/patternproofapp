import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { SupportReplyForm } from "@/components/admin/SupportReplyForm";
import { listSupportRequests, type SupportInboxRow } from "@/lib/support-inbox.functions";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support inbox — PatternProof" },
      { name: "description", content: "Support messages sent through the PatternProof help form." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SupportInbox,
});

function SupportInbox() {
  const listFn = useServerFn(listSupportRequests);
  const [rows, setRows] = useState<SupportInboxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listFn()
      .then((r) => {
        setRows(r.requests);
        setError(null);
      })
      .catch(() => setError("We couldn't load support messages. This page is for PatternProof staff."));
  }, [listFn]);

  useEffect(load, [load]);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: 0 }}>Support inbox</h1>
        <button className="btn-primary" onClick={load}>Refresh</button>
      </div>
      {error ? <p style={{ fontSize: 14 }}>{error}</p> : null}
      {rows && rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          No messages yet — new support requests will appear here.
        </p>
      ) : null}
      {(rows ?? []).map((r) => (
        <article key={r.id} className="card-pp" style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>
              {r.name || "No name given"} · <a href={`mailto:${r.reply_email}`}>{r.reply_email}</a>
            </strong>
            <time style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} dateTime={r.created_at}>
              {new Date(r.created_at).toLocaleString()}
            </time>
          </div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}>
            {r.category} · {r.status === "replied" ? "Replied" : "Awaiting reply"} · {r.user_id ? "Signed-in account" : "Logged-out visitor"}
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{r.message}</p>
          <SupportReplyForm id={r.id} replyBody={r.reply_body} repliedAt={r.replied_at} onReplied={load} />
        </article>
      ))}
    </div>
  );
}
