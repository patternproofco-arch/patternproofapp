import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { respondToRecordRequest, listMyShareableRecords } from "@/lib/record-requests.functions";

type Request = {
  id: string;
  include_incidents: boolean;
  include_evidence: boolean;
  download_allowed: boolean;
};
type Records = Awaited<ReturnType<typeof listMyShareableRecords>>;

/** Survivor's answer to one request. Nothing moves until they choose here. */
export function RequestResponsePanel({ request, onDone }: { request: Request; onDone: () => void }) {
  const respondFn = useServerFn(respondToRecordRequest);
  const recordsFn = useServerFn(listMyShareableRecords);
  const [records, setRecords] = useState<Records | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [incidentIds, setIncidentIds] = useState<string[]>([]);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [download, setDownload] = useState(request.download_allowed);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (narrow && !records) recordsFn().then(setRecords).catch(() => setRecords(null));
  }, [narrow, records, recordsFn]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const send = async (decision: "approve" | "modify" | "decline") => {
    setBusy(true);
    try {
      await respondFn({
        data: {
          id: request.id,
          decision,
          note: note.trim() || undefined,
          ...(decision === "modify"
            ? {
                incident_ids: request.include_incidents ? incidentIds : [],
                evidence_ids: request.include_evidence ? evidenceIds : [],
                download_allowed: download,
              }
            : decision === "approve"
              ? { download_allowed: download }
              : {}),
        },
      });
      toast(decision === "decline" ? "Declined. Nothing was shared." : "Saved. Only what you chose is shared.");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      {request.download_allowed ? (
        <label className="text-[13.5px] flex items-center gap-2">
          <input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} />
          Let them download files as well as read descriptions
        </label>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          They didn't ask to download files, so they'll see descriptions only.
        </p>
      )}

      <label className="mt-3 flex items-center gap-2 text-[13.5px]">
        <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} />
        Choose exactly which records to include
      </label>

      {narrow ? (
        !records ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--muted-foreground)" }}>Opening your records…</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {request.include_incidents ? (
              <div>
                <p className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Marks</p>
                <div className="mt-2 grid max-h-56 gap-1 overflow-auto text-[13px]">
                  {records.incidents.map((i) => (
                    <label key={i.id} className="flex gap-2">
                      <input type="checkbox" checked={incidentIds.includes(i.id)}
                        onChange={() => toggle(incidentIds, setIncidentIds, i.id)} />
                      <span>{i.date ?? "Undated"} — {(i.description ?? "").slice(0, 70)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {request.include_evidence ? (
              <div>
                <p className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Evidence</p>
                <div className="mt-2 grid max-h-56 gap-1 overflow-auto text-[13px]">
                  {records.evidence.map((e) => (
                    <label key={e.id} className="flex gap-2" style={{ opacity: e.is_sealed ? 0.55 : 1 }}>
                      <input type="checkbox" disabled={e.is_sealed} checked={evidenceIds.includes(e.id)}
                        onChange={() => toggle(evidenceIds, setEvidenceIds, e.id)} />
                      <span>{e.title ?? "Untitled"}{e.is_sealed ? " — sealed, stays private" : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      <textarea
        className="mt-3 w-full rounded-lg border p-2 text-[13.5px]"
        style={{ borderColor: "var(--border)", minHeight: 60 }}
        placeholder="Anything you want them to know (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="pp-btn" onClick={() => send(narrow ? "modify" : "approve")}>
          {busy ? "Saving…" : narrow ? "Share only what I picked" : "Share as asked"}
        </button>
        <button type="button" disabled={busy} className="pp-btn pp-btn--quiet" onClick={() => send("decline")}>
          Decline
        </button>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
        You can withdraw this at any time. Anything already downloaded before you withdraw stays with them.
      </p>
    </div>
  );
}
