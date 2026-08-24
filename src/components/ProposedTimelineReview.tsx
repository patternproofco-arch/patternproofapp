import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  acceptProposedIncident,
  denyProposedIncident,
  listProposedIncidents,
  proposeTimelineFromEvidence,
} from "@/lib/propose-timeline.functions";
import { toast } from "sonner";
import { Check, Pencil, Sparkles, Trash2, X } from "lucide-react";

type Draft = {
  date?: string | null;
  time?: string | null;
  location?: string | null;
  description?: string;
  abuse_types?: string[];
  witnesses?: string | null;
  emotional_impact?: string | null;
  people_present?: string | null;
};

type Proposal = {
  id: string;
  batch_id: string;
  sort_key: string | null;
  date_certainty: string;
  draft: Draft;
  source_evidence_ids: string[];
  source_summary: string | null;
  confidence_notes: string[];
  status: string;
  created_at: string;
};

/**
 * Review queue for AI-proposed timeline entries.
 * Nothing becomes a real incident until the survivor accepts (optionally after editing).
 */
export function ProposedTimelineReview({ onAccepted }: { onAccepted?: () => void }) {
  const listFn = useServerFn(listProposedIncidents);
  const proposeFn = useServerFn(proposeTimelineFromEvidence);
  const acceptFn = useServerFn(acceptProposedIncident);
  const denyFn = useServerFn(denyProposedIncident);

  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await listFn({});
      setItems((r.items as Proposal[]) ?? []);
    } catch {
      /* silent — empty state is fine */
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runOrganize = async () => {
    setRunning(true);
    try {
      const r = await proposeFn({
        data: {
          include_threads: true,
          include_voice_notes: true,
          max_items: 40,
        },
      });
      if (!r.ok) {
        toast(r.reason ?? "Could not organize uploads right now.");
        return;
      }
      if (!r.proposed_timeline?.length) {
        toast(r.message ?? "No new draft entries from your current uploads.");
      } else {
        toast(`${r.proposed_timeline.length} draft${r.proposed_timeline.length === 1 ? "" : "s"} ready to review.`);
      }
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not organize uploads.");
    } finally {
      setRunning(false);
    }
  };

  const startEdit = (p: Proposal) => {
    setEditingId(p.id);
    setEditDraft({ ...(p.draft ?? {}) });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const onAccept = async (p: Proposal, withEdits?: Draft) => {
    setBusyId(p.id);
    try {
      await acceptFn({
        data: {
          proposal_id: p.id,
          ...(withEdits ? { edits: withEdits } : {}),
        },
      });
      toast("Added to your timeline.");
      setEditingId(null);
      setEditDraft(null);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      onAccepted?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not accept that entry.");
    } finally {
      setBusyId(null);
    }
  };

  const onDeny = async (p: Proposal) => {
    setBusyId(p.id);
    try {
      await denyFn({ data: { proposal_id: p.id } });
      toast("Draft discarded.");
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not discard that entry.");
    } finally {
      setBusyId(null);
    }
  };

  const certaintyLabel =
    (c: string) =>
      c === "confirmed" ? "Date confirmed" : c === "approximate" ? "Date approximate" : "Date unknown";

  return (
    <section
      className="mt-6"
      style={{ background: "var(--pp-paper)", padding: 20, boxShadow: "var(--pp-shadow-sm)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="exhibit-tag">AI DRAFTS</span>
            <span className="mono-meta mono-meta--muted">Review before anything is saved</span>
          </div>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--pp-muted)", maxWidth: 520, lineHeight: 1.5 }}>
            Your uploads can be organized into chronological draft entries. Each draft is a suggestion
            only — accept, edit, or delete. Nothing joins your timeline until you accept it.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          disabled={running}
          onClick={() => void runOrganize()}
        >
          <Sparkles size={14} />
          {running ? "Organizing…" : "Organize uploads"}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--pp-muted)" }}>
          Checking for drafts…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--pp-muted)" }}>
          No pending drafts. Upload evidence, then use Organize uploads to generate suggestions.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((p) => {
            const isEditing = editingId === p.id;
            const draft = isEditing && editDraft ? editDraft : p.draft;
            const busy = busyId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-2xl p-4"
                style={{
                  background: "var(--pp-card)",
                  boxShadow: "var(--pp-shadow-sm)",
                  borderLeft: "3px solid var(--pp-accent)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--pp-muted)" }}>
                  <span className="font-semibold">{certaintyLabel(p.date_certainty)}</span>
                  {p.sort_key && <span>· {p.sort_key}</span>}
                  {(p.source_evidence_ids?.length ?? 0) > 0 && (
                    <span>· {p.source_evidence_ids.length} source file{p.source_evidence_ids.length === 1 ? "" : "s"}</span>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-3 grid gap-2">
                    <label className="label-eyebrow">Description</label>
                    <textarea
                      className="input-pp"
                      rows={4}
                      value={draft?.description ?? ""}
                      onChange={(e) => setEditDraft({ ...draft, description: e.target.value })}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className="label-eyebrow">Date</label>
                        <input
                          type="date"
                          className="input-pp mt-1"
                          value={draft?.date ?? ""}
                          onChange={(e) => setEditDraft({ ...draft, date: e.target.value || null })}
                        />
                      </div>
                      <div>
                        <label className="label-eyebrow">Time</label>
                        <input
                          type="time"
                          className="input-pp mt-1"
                          value={draft?.time ?? ""}
                          onChange={(e) => setEditDraft({ ...draft, time: e.target.value || null })}
                        />
                      </div>
                      <div>
                        <label className="label-eyebrow">Location</label>
                        <input
                          className="input-pp mt-1"
                          value={draft?.location ?? ""}
                          onChange={(e) =>
                            setEditDraft({ ...draft, location: e.target.value || null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--pp-ink)" }}>
                      {draft?.description || "(no description)"}
                    </p>
                    {(draft?.location || draft?.time) && (
                      <p className="mt-1 text-[12px]" style={{ color: "var(--pp-muted)" }}>
                        {[draft?.time, draft?.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </>
                )}

                {p.source_summary && (
                  <p className="mt-2 text-[12px]" style={{ color: "var(--pp-muted)" }}>
                    {p.source_summary}
                  </p>
                )}
                {(p.confidence_notes?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--pp-muted)" }}>
                    {p.confidence_notes.map((n, i) => (
                      <li key={i}>· {n}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1 text-[12px]"
                        disabled={busy}
                        onClick={() => void onAccept(p, editDraft ?? undefined)}
                      >
                        <Check size={13} /> {busy ? "Saving…" : "Save & accept"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                        disabled={busy}
                        onClick={cancelEdit}
                      >
                        <X size={13} /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1 text-[12px]"
                        disabled={busy}
                        onClick={() => void onAccept(p)}
                      >
                        <Check size={13} /> {busy ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                        disabled={busy}
                        onClick={() => startEdit(p)}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1 text-[12px]"
                        disabled={busy}
                        onClick={() => void onDeny(p)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
