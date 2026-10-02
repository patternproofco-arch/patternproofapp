import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  acceptProposedIncident,
  denyProposedIncident,
  listDraftSourceMaterials,
  listProposedIncidents,
  proposeTimelineFromEvidence,
  saveDraftSourceText,
} from "@/lib/propose-timeline.functions";
import { toast } from "sonner";
import { Check, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  PipelineStatusChips,
  draftPipelineChips,
  originChipLabel,
} from "@/components/survivor/PipelineStatusChips";
import { DraftTrustHingeInline } from "@/components/sharing/DraftTrustHinge";
import {
  normalizeShareReadiness,
  type ShareReadiness,
} from "@/lib/sharing/share-readiness";

type Draft = {
  date?: string | null;
  time?: string | null;
  location?: string | null;
  description?: string;
  abuse_types?: string[];
  witnesses?: string | null;
  emotional_impact?: string | null;
  people_present?: string | null;
  /** Set only on drafts built from an answer to a professional's request. */
  share_with_link_id?: string | null;
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
  /** Null on soft upload / request drafts; set when Organize uploads used a model. */
  model?: string | null;
};

type SourceMaterial = {
  evidence_id: string;
  title: string;
  kind: "audio" | "video" | "photo" | "file";
  field: "transcript" | "extracted_text";
  text: string;
  status: string | null;
};

/**
 * Review queue for soft upload drafts, request-answer drafts, and AI Organize suggestions.
 * Nothing becomes a real incident until the survivor accepts (optionally after editing).
 * Accept never invents a share — binder only when the draft already carried a share link.
 */
export function ProposedTimelineReview({ onAccepted }: { onAccepted?: () => void }) {
  const listFn = useServerFn(listProposedIncidents);
  const proposeFn = useServerFn(proposeTimelineFromEvidence);
  const acceptFn = useServerFn(acceptProposedIncident);
  const denyFn = useServerFn(denyProposedIncident);
  const sourceFn = useServerFn(listDraftSourceMaterials);
  const saveSourceFn = useServerFn(saveDraftSourceText);

  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sourceItems, setSourceItems] = useState<SourceMaterial[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [listError, setListError] = useState(false);
  /** Soft CLEAR readiness chosen at the accept hinge. Default private. */
  const [readinessById, setReadinessById] = useState<Record<string, ShareReadiness>>({});

  const reload = useCallback(async () => {
    try {
      const r = await listFn({});
      setItems((r.items as Proposal[]) ?? []);
      setListError(false);
    } catch {
      // Distinguish "couldn't load" from true empty — soft drafts may exist.
      setListError(true);
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
        toast(
          `${r.proposed_timeline.length} draft${r.proposed_timeline.length === 1 ? "" : "s"} ready to review.`,
        );
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
    setSourceItems([]);
    if ((p.source_evidence_ids?.length ?? 0) > 0) {
      setSourceLoading(true);
      void sourceFn({ data: { proposal_id: p.id } })
        .then((r) => setSourceItems((r.items as SourceMaterial[]) ?? []))
        .catch(() => setSourceItems([]))
        .finally(() => setSourceLoading(false));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setSourceItems([]);
    setSourceLoading(false);
  };

  const onAccept = async (p: Proposal, withEdits?: Draft) => {
    setBusyId(p.id);
    try {
      // Persist survivor-edited transcript / OCR before the entry joins the timeline.
      if (withEdits && sourceItems.length > 0) {
        for (const src of sourceItems) {
          await saveSourceFn({
            data: {
              evidence_id: src.evidence_id,
              field: src.field,
              text: src.text,
            },
          });
        }
      }
      const share_readiness = normalizeShareReadiness(readinessById[p.id]);
      const r = await acceptFn({
        data: {
          proposal_id: p.id,
          share_readiness,
          ...(withEdits ? { edits: withEdits } : {}),
        },
      });
      toast(
        r?.shared
          ? "Added to your timeline and to the binder your attorney sees."
          : "Added to your timeline.",
      );
      setEditingId(null);
      setEditDraft(null);
      setSourceItems([]);
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

  const certaintyLabel = (c: string) =>
    c === "confirmed"
      ? "Date confirmed"
      : c === "approximate"
        ? "Date approximate"
        : "Date unknown";

  return (
    <section
      className="mt-6"
      style={{ background: "var(--pp-paper)", padding: 20, boxShadow: "var(--pp-shadow-sm)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="exhibit-tag">DRAFTS TO REVIEW</span>
            <span className="mono-meta mono-meta--muted">You decide before anything is saved</span>
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--pp-muted)",
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            Soft uploads, answers to requests, and Organize suggestions land here as drafts. Each
            is a suggestion only — accept, edit, or delete. Nothing joins your timeline until you
            accept it, and nothing is newly shared unless this draft already came from a share you
            chose.
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
      ) : listError ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--pp-muted)" }}>
          We couldn&apos;t load drafts right now. Try refreshing — nothing was discarded.
        </p>
      ) : items.length === 0 ? (
        <div className="pp-draft-empty-honesty" data-testid="drafts-empty-honesty">
          <div className="label-eyebrow">Nothing in drafts right now</div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--pp-ink)" }}>
            When you save a draft, it&apos;ll show up here. Empty here does not mean your files are
            gone.
          </p>
          <ul
            className="mt-2 space-y-1 text-[12px] leading-relaxed"
            style={{ color: "var(--pp-muted)" }}
          >
            <li>
              · Soft drafts appear after you preserve a photo, audio, or video on{" "}
              <Link to="/evidence" style={{ textDecoration: "underline" }}>
                Evidence
              </Link>
              .
            </li>
            <li>· Organize uploads can suggest chronological entries from what you already saved.</li>
            <li>
              · Answers you send to a professional can also queue a draft here for your timeline —
              soft claims only; you still approve.
            </li>
          </ul>
          <p className="mt-3 text-[12px]" style={{ color: "var(--pp-muted)" }}>
            Nothing is on your timeline or newly shared until you accept a draft.
          </p>
          <div className="mt-3">
            <PipelineStatusChips
              chips={draftPipelineChips({ fromRequest: false, willJoinBinder: false })}
              aria-label="Pipeline when you have a draft"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((p) => {
            const isEditing = editingId === p.id;
            const draft = isEditing && editDraft ? editDraft : p.draft;
            const busy = busyId === p.id;
            const fromRequest = Boolean(draft?.share_with_link_id);
            const willJoinBinder = fromRequest;
            const origin = originChipLabel({ fromRequest, model: p.model });
            const chips = draftPipelineChips({ fromRequest, willJoinBinder });
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="exhibit-tag">{origin}</span>
                  <PipelineStatusChips
                    chips={chips}
                    aria-label="Request, draft, timeline, and binder status"
                  />
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-[11px]"
                  style={{ color: "var(--pp-muted)" }}
                >
                  <span className="font-semibold">{certaintyLabel(p.date_certainty)}</span>
                  {p.sort_key && <span>· {p.sort_key}</span>}
                  {(p.source_evidence_ids?.length ?? 0) > 0 && (
                    <span>
                      · {p.source_evidence_ids.length} source file
                      {p.source_evidence_ids.length === 1 ? "" : "s"}
                    </span>
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
                    {(sourceLoading || sourceItems.length > 0) && (
                      <div
                        className="mt-3 rounded-xl p-3"
                        style={{
                          background: "var(--pp-paper)",
                          boxShadow: "var(--pp-shadow-sm)",
                        }}
                      >
                        <div className="label-eyebrow">Source text to review</div>
                        <p
                          className="mt-1 text-[12px] leading-relaxed"
                          style={{ color: "var(--pp-muted)" }}
                        >
                          Check the transcript or photo text before this joins your timeline. Soft
                          claims only — edit what is wrong; nothing is shared until you already
                          chose to share.
                        </p>
                        {sourceLoading ? (
                          <p className="mt-2 text-[12px]" style={{ color: "var(--pp-muted)" }}>
                            Loading source text…
                          </p>
                        ) : (
                          <div className="mt-2 space-y-3">
                            {sourceItems.map((src) => (
                              <div key={src.evidence_id}>
                                <label className="label-eyebrow">
                                  {src.kind === "audio" || src.kind === "video"
                                    ? "Transcript"
                                    : src.kind === "photo"
                                      ? "Photo text (OCR)"
                                      : "Extracted text"}{" "}
                                  · {src.title}
                                </label>
                                <textarea
                                  className="input-pp mt-1"
                                  rows={4}
                                  value={src.text}
                                  onChange={(e) =>
                                    setSourceItems((prev) =>
                                      prev.map((row) =>
                                        row.evidence_id === src.evidence_id
                                          ? { ...row, text: e.target.value }
                                          : row,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p
                      className="mt-2 text-[14px] leading-relaxed"
                      style={{ color: "var(--pp-ink)" }}
                    >
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

                <div className="pp-draft-trust-hinge" data-testid="draft-accept-pipeline-cue">
                  <p className="mb-3 text-[12px] leading-relaxed" style={{ color: "var(--pp-muted)" }}>
                    {willJoinBinder
                      ? "Accept adds this to your timeline and to the binder for the professional share this draft already belongs to. Soft claims only."
                      : "Accept adds this to your timeline. It does not newly share with an attorney or advocate unless you already chose a share for this draft."}
                  </p>
                  <DraftTrustHingeInline
                    value={normalizeShareReadiness(readinessById[p.id])}
                    onChange={(v) =>
                      setReadinessById((prev) => ({
                        ...prev,
                        [p.id]: v,
                      }))
                    }
                  />
                </div>

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
