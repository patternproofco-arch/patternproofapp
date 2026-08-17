import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { listFollowUps, createFollowUp, updateFollowUp } from "@/lib/org-followups.functions";
import { FOLLOW_UP_STATUSES } from "@/lib/record-requests.schema";

export const Route = createFileRoute("/_advocate/org/follow-ups")({
  component: FollowUps,
});

type Data = Awaited<ReturnType<typeof listFollowUps>>;

const LABEL: Record<string, string> = {
  offered: "Offered", accepted: "Accepted", scheduled: "Scheduled",
  completed: "Completed", declined: "Declined",
};

function FollowUps() {
  const listFn = useServerFn(listFollowUps);
  const createFn = useServerFn(createFollowUp);
  const updateFn = useServerFn(updateFollowUp);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [resource, setResource] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listFn().then(setData).catch(() => setData(null));
  }, [listFn]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!label.trim()) { toast("Give this handoff a short reference so your team can find it."); return; }
    setBusy(true);
    try {
      await createFn({
        data: {
          reference_label: label.trim(),
          resource_reference: resource.trim() || undefined,
          due_at: due ? new Date(due).toISOString() : null,
          note: note.trim() || undefined,
          status: "offered",
        },
      });
      setLabel(""); setResource(""); setDue(""); setNote(""); setOpen(false);
      toast("Saved.");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="orgx-eyebrow">Coordination</p>
      <h1 style={{ margin: "8px 0 10px" }}>Follow-ups and warm handoffs</h1>
      <p className="orgx-muted" style={{ fontSize: 15, maxWidth: 660 }}>
        Track a handoff your team has offered — whether it was accepted, scheduled, completed or
        declined — with a due date and a neutral note.
      </p>
      <p className="orgx-muted" style={{ fontSize: 13, maxWidth: 660, marginTop: 8 }}>
        These notes are for coordination only. They are not part of anyone's evidence record, they
        are never copied into a survivor's account, and they are never included in a
        professional-review packet or any export.
      </p>

      {open ? (
        <div className="orgx-card" style={{ display: "grid", gap: 12, marginTop: 20, maxWidth: 560 }}>
          <label style={{ fontSize: 13 }}>
            Reference
            <input className="orgx-input" style={{ width: "100%", marginTop: 4 }} value={label}
              placeholder="A short label your team recognises"
              onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label style={{ fontSize: 13 }}>
            Resource or partner (optional)
            <input className="orgx-input" style={{ width: "100%", marginTop: 4 }} value={resource}
              onChange={(e) => setResource(e.target.value)} />
          </label>
          <label style={{ fontSize: 13 }}>
            Due (optional)
            <input type="datetime-local" className="orgx-input" style={{ width: "100%", marginTop: 4 }}
              value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label style={{ fontSize: 13 }}>
            Neutral note (optional)
            <textarea className="orgx-input" style={{ width: "100%", marginTop: 4, minHeight: 70 }}
              value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="orgx-btn" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save handoff"}
            </button>
            <button type="button" className="orgx-btn orgx-btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="orgx-btn" style={{ marginTop: 20 }} onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden /> New handoff
        </button>
      )}

      <h2 className="orgx-eyebrow" style={{ margin: "32px 0 12px" }}>Open and recent</h2>
      {!data ? (
        <p className="orgx-muted" style={{ fontSize: 13.5 }}>Opening…</p>
      ) : data.follow_ups.length === 0 ? (
        <div className="orgx-empty">Nothing here yet — a handoff appears once your team records one.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {data.follow_ups.map((f) => (
            <div key={f.id} className="orgx-card">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14.5 }}>{f.reference_label ?? "Handoff"}</strong>
                <span className="orgx-chip" data-tone={f.status === "completed" ? "active" : f.status === "declined" ? "ended" : "attention"}>
                  {LABEL[f.status] ?? f.status}
                </span>
                {f.due_at ? (
                  <span className="orgx-muted" style={{ fontSize: 12.5 }}>
                    Due {new Date(f.due_at).toLocaleString()}
                  </span>
                ) : null}
              </div>
              {f.resource_reference ? (
                <p className="orgx-muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>{f.resource_reference}</p>
              ) : null}
              {f.note ? <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>{f.note}</p> : null}
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {FOLLOW_UP_STATUSES.filter((s) => s !== f.status).map((s) => (
                  <button key={s} type="button" className="orgx-btn orgx-btn-quiet"
                    style={{ minHeight: 30, padding: "4px 9px", fontSize: 12 }}
                    onClick={async () => {
                      try { await updateFn({ data: { id: f.id, status: s } }); load(); }
                      catch { toast("We couldn't update that. Try again in a moment."); }
                    }}>
                    Mark {LABEL[s]?.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
