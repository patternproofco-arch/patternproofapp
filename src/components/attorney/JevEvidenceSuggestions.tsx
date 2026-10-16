import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { suggestEntryLink, suggestRecordGroups } from "@/lib/jev-proposals.functions";
import { upsertEvidenceReview } from "@/lib/attorney-evidence-reviews.functions";
import { confirmJevProcessing, JEV_BATCH_SIZE, RECORD_GROUPS } from "@/lib/jev-proposals";
import type { JevChoiceProposal, RecordGroup } from "@/lib/jev-proposals";

export function JevEntryLinkSuggestion({
  clientId,
  evidenceId,
  onApplied,
}: {
  clientId: string;
  evidenceId: string;
  onApplied: (incidentId: string) => void;
}) {
  const suggest = useServerFn(suggestEntryLink);
  const save = useServerFn(upsertEvidenceReview);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    suggestion: JevChoiceProposal | null;
    checkedCount: number;
    model: string | null;
  } | null>(null);
  const [applied, setApplied] = useState(false);
  async function check() {
    if (
      !confirmJevProcessing(
        "this file's saved text and up to 40 currently shared documented entries",
      )
    )
      return;
    setBusy(true);
    setResult(null);
    setApplied(false);
    try {
      setResult(await suggest({ data: { clientId, evidenceId, aiConsent: true } }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't check for an entry link.");
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!result?.suggestion) return;
    setBusy(true);
    try {
      await save({ data: { clientId, evidenceId, linked_incident_id: result.suggestion.id } });
      onApplied(result.suggestion.id);
      setApplied(true);
      toast("Entry reference saved in your attorney review.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save that reference.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 text-xs">
      <button
        type="button"
        className="att-btn-secondary"
        disabled={busy}
        onClick={() => void check()}
      >
        {busy ? "Checking…" : "Suggest entry link with Jev"}
      </button>
      {result && (
        <div className="mt-2" aria-live="polite">
          <p>
            Software suggestion · {result.model ?? "No AI call needed"} · {result.checkedCount}{" "}
            eligible entries checked
          </p>
          {result.suggestion ? (
            <>
              <p className="mt-1">Possible entry: {result.suggestion.label}</p>
              <p>
                Check the file and entry before confirming. This reference is private to your
                review.
              </p>
              <button
                type="button"
                className="att-btn-secondary mt-2"
                disabled={busy || applied}
                onClick={() => void apply()}
              >
                {applied ? "Reference saved" : "Confirm entry reference"}
              </button>
            </>
          ) : (
            <p>No confident match in the checked entries. You can review manually.</p>
          )}
          <button
            type="button"
            className="att-btn-secondary mt-2"
            disabled={busy}
            onClick={() => setResult(null)}
          >
            Dismiss suggestion
          </button>
        </div>
      )}
    </div>
  );
}

export function JevRecordGrouping({
  clientId,
  evidenceIds,
  groups,
  selected,
  onGroups,
  onSelect,
}: {
  clientId: string;
  evidenceIds: string[];
  groups: Record<string, RecordGroup>;
  selected: string;
  onGroups: (groups: Record<string, RecordGroup>) => void;
  onSelect: (group: string) => void;
}) {
  const suggest = useServerFn(suggestRecordGroups);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  async function check() {
    if (
      !confirmJevProcessing(
        `saved text from the first ${Math.min(JEV_BATCH_SIZE, evidenceIds.length)} files in this review queue`,
      )
    )
      return;
    setBusy(true);
    onSelect("all");
    try {
      const batch = evidenceIds.slice(0, JEV_BATCH_SIZE);
      const r = await suggest({
        data: { clientId, evidenceIds: batch, aiConsent: true },
      });
      // A previously grouped file may have become ineligible since the last check.
      const kept = Object.fromEntries(Object.entries(groups).filter(([id]) => !batch.includes(id)));
      onGroups({ ...kept, ...Object.fromEntries(r.groups.map((g) => [g.evidenceId, g.group])) });
      setModel(r.model);
      if (!r.groups.length) toast("No AI-eligible files in this batch. You can review manually.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't group these files.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="att-card mb-4 text-xs">
      <button
        type="button"
        className="att-btn-secondary"
        disabled={busy || !evidenceIds.length}
        onClick={() => void check()}
      >
        {busy ? "Checking record types…" : "Group up to 20 files with Jev"}
      </button>
      <p className="mt-2">
        Optional software groups for this view only. Original files, review statuses, and sharing
        stay as you set them.
      </p>
      {Object.keys(groups).length > 0 && (
        <>
          <p className="mt-2">
            Software suggestion · {model} · {Object.keys(groups).length} files grouped
          </p>
          <label className="mt-2 block">
            View suggested group
            <select
              className="att-input ml-2"
              value={selected}
              onChange={(e) => onSelect(e.target.value)}
            >
              <option value="all">All files</option>
              {Object.entries(RECORD_GROUPS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label} ({Object.values(groups).filter((g) => g === key).length})
                </option>
              ))}
              <option value="unchecked">Unchecked files</option>
            </select>
          </label>
          <button
            type="button"
            className="att-btn-secondary mt-2"
            onClick={() => {
              onGroups({});
              onSelect("all");
              setModel(null);
            }}
          >
            Clear suggested groups
          </button>
        </>
      )}
    </div>
  );
}
