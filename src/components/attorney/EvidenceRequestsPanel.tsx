import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createEvidenceRequest,
  listClientEvidenceRequests,
  type ProfessionalRequest,
} from "@/lib/evidence-requests.functions";

interface EvidenceRequestsPanelProps {
  clientId: string;
}

const STATUS: Record<string, string> = {
  open: "Waiting on client",
  submitted: "Answered",
  declined: "Client passed",
};

export function EvidenceRequestsPanel({ clientId }: EvidenceRequestsPanelProps) {
  const listFn = useServerFn(listClientEvidenceRequests);
  const createFn = useServerFn(createEvidenceRequest);
  const [items, setItems] = useState<ProfessionalRequest[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [kind, setKind] = useState<"document" | "photo" | "recording" | "note">("document");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listFn({ data: { clientId } })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [listFn, clientId]);
  useEffect(load, [load]);

  const send = async () => {
    if (!title.trim()) return toast("Add a short title.");
    setBusy(true);
    try {
      await createFn({
        data: {
          clientId,
          title: title.trim(),
          details: details.trim() || undefined,
          kind,
          due_at: due ? new Date(`${due}T23:59:00`).toISOString() : null,
        },
      });
      setTitle("");
      setDetails("");
      setDue("");
      toast("Request sent. Your client sees it only in their Requests tray.");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send that request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="att-card">
      <div className="att-eyebrow">Evidence requests</div>
      <h3 style={{ fontSize: 16, marginTop: 4 }}>Ask your client for something specific</h3>
      <p style={{ fontSize: 12, color: "var(--att-text-2)", marginTop: 4 }}>
        Your client can answer, keep a private draft, or pass. You only see an answer after they
        press Send, and only the files they pick.
      </p>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <input
          className="att-input"
          placeholder="e.g. Files from previous court appearances"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="att-input"
          rows={2}
          placeholder="Details (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="att-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="document">Document</option>
            <option value="photo">Photo</option>
            <option value="recording">Recording</option>
            <option value="note">Written note</option>
          </select>
          <input className="att-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button className="att-btn-primary" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 8 }}>
          {items.map((r) => (
            <li key={r.id} style={{ padding: "10px 12px", background: "var(--att-surface-2)", borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{r.title}</strong>
                <span style={{ fontSize: 12, color: "var(--att-text-2)" }}>{STATUS[r.status] ?? r.status}</span>
              </div>
              {r.status === "submitted" && (
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {r.response_note ?? "No note."} · {r.shared_file_count} file
                  {r.shared_file_count === 1 ? "" : "s"} shared
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
