import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  declineEvidenceRequest,
  saveEvidenceRequestDraft,
  submitEvidenceRequest,
  type SurvivorRequest,
} from "@/lib/evidence-requests.functions";
import {
  PipelineStatusChips,
  requestPipelineChips,
} from "@/components/survivor/PipelineStatusChips";

interface EvidenceOption {
  id: string;
  title: string;
}

interface RequestCardProps {
  request: SurvivorRequest;
  evidence: EvidenceOption[];
  onChanged: () => void;
}

const KIND_LABEL: Record<string, string> = {
  document: "Document",
  photo: "Photo",
  recording: "Recording",
  note: "Written note",
};

export function RequestCard({ request, evidence, onChanged }: RequestCardProps) {
  const save = useServerFn(saveEvidenceRequestDraft);
  const submit = useServerFn(submitEvidenceRequest);
  const decline = useServerFn(declineEvidenceRequest);
  const [note, setNote] = useState(request.response_note ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(request.response_evidence_ids));
  const [busy, setBusy] = useState(false);
  const open = request.status === "open";

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "We couldn't save that. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  const payload = { id: request.id, note, evidence_ids: [...picked] };

  const chips = requestPipelineChips(request.status);

  return (
    <li className="card" style={{ padding: 16, borderLeft: "3px solid var(--primary)" }}>
      <div className="label-eyebrow">
        {KIND_LABEL[request.kind] ?? "Request"}
        {request.from_name ? ` · from ${request.from_name}` : ""}
        {request.due_at ? ` · by ${new Date(request.due_at).toLocaleDateString()}` : ""}
      </div>
      <div className="mt-2">
        <PipelineStatusChips
          chips={chips}
          aria-label="Request to draft to binder status"
        />
      </div>
      <h3 className="mt-2 font-serif text-[18px]">{request.title}</h3>
      {request.details && <p className="mt-1 text-[14px]">{request.details}</p>}

      {!open && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          {request.status === "submitted"
            ? `Sent ${new Date(request.submitted_at ?? request.created_at).toLocaleDateString()}.`
            : "You chose not to answer this one. That's okay."}
        </p>
      )}

      {open && (
        <div className="mt-3 grid gap-3">
          <textarea
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note if you'd like (optional)"
          />
          {evidence.length > 0 && (
            <fieldset>
              <legend className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Pick files to send with your answer. Only these are shared.
              </legend>
              <div className="mt-2 grid max-h-48 gap-1 overflow-auto">
                {evidence.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-[14px]">
                    <input
                      type="checkbox"
                      checked={picked.has(e.id)}
                      onChange={() =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(e.id)) n.delete(e.id);
                          else n.add(e.id);
                          return n;
                        })
                      }
                    />
                    {e.title}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            Nothing is visible to them until you press Send. Saved drafts stay private. After Send,
            a soft draft may appear under Drafts to review for your timeline — accepting that draft
            is separate from what you already sent.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => submit({ data: payload }), "Sent. Only what you picked was shared.")}
            >
              Send answer
            </button>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => run(() => save({ data: payload }), "Saved privately.")}
            >
              Save draft
            </button>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => run(() => decline({ data: { id: request.id } }), "Okay. We let them know you passed.")}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
