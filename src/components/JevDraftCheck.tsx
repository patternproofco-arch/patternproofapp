import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { checkDraftWithJev } from "@/lib/jev-proposals.functions";
import { confirmJevProcessing, JEV_BATCH_SIZE } from "@/lib/jev-proposals";
import type { JevDraftCheck as DraftCheck } from "@/lib/jev-proposals";

export function JevDraftCheck({
  proposalId,
  candidateIds,
  onEdit,
}: {
  proposalId: string;
  candidateIds: string[];
  onEdit: () => void;
}) {
  const check = useServerFn(checkDraftWithJev);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DraftCheck | null>(null);
  async function run() {
    if (
      !confirmJevProcessing(
        "this saved draft and up to 20 other pending drafts for duplicate, date and place checks",
      )
    )
      return;
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await check({
          data: {
            proposalId,
            candidateIds: candidateIds.filter((id) => id !== proposalId).slice(0, JEV_BATCH_SIZE),
            aiConsent: true,
          },
        }),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check this draft.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 text-xs">
      <button type="button" className="btn-ghost" disabled={busy} onClick={() => void run()}>
        {busy ? "Checking draft…" : "Check draft with Jev"}
      </button>
      {result && (
        <div className="mt-2" aria-live="polite">
          <p>
            Software suggestions · {result.model} · compared with {result.checkedCount} other
            eligible drafts
          </p>
          <ul className="mt-1 space-y-1">
            {result.duplicate && (
              <li>
                Possible duplicate: {result.duplicate.label}. Compare both drafts before deciding.
              </li>
            )}
            {result.checkDate && (
              <li>Check the event date. Leave it unknown if you do not know.</li>
            )}
            {result.checkPlace && <li>Check the place. Leave it blank if you do not know.</li>}
          </ul>
          {!result.duplicate && !result.checkDate && !result.checkPlace && (
            <p>No review flags from this check. You still decide what to keep.</p>
          )}
          <p className="mt-1">
            Your wording stays as written. Nothing is merged, discarded, accepted, or shared by this
            check.
          </p>
          <button type="button" className="btn-ghost mt-2" onClick={onEdit}>
            Review and edit draft
          </button>
          <button type="button" className="btn-ghost mt-2" onClick={() => setResult(null)}>
            Dismiss suggestions
          </button>
        </div>
      )}
    </div>
  );
}
