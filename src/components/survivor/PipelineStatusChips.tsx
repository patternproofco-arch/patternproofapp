/**
 * Soft-claim status chips: Request → Draft → Timeline → Binder.
 * Visual cues only — never implies court filing or automatic sharing.
 */

export type PipelineStage = "request" | "draft" | "timeline" | "binder";
export type ChipState = "idle" | "active" | "next" | "done";

export type PipelineChipModel = {
  stage: PipelineStage;
  label: string;
  state: ChipState;
};

const STAGE_ORDER: PipelineStage[] = ["request", "draft", "timeline", "binder"];

const DEFAULT_LABELS: Record<PipelineStage, string> = {
  request: "Request",
  draft: "Draft",
  timeline: "Sent",
  binder: "In their binder",
};

/** Build chip states for a pending draft under survivor review. */
export function draftPipelineChips(opts: {
  fromRequest: boolean;
  /** Accept will also merge into an already-chosen share (binder). */
  willJoinBinder: boolean;
}): PipelineChipModel[] {
  const { fromRequest, willJoinBinder } = opts;
  return [
    {
      stage: "request",
      label: DEFAULT_LABELS.request,
      state: fromRequest ? "done" : "idle",
    },
    {
      stage: "draft",
      label: DEFAULT_LABELS.draft,
      state: "active",
    },
    {
      stage: "timeline",
      label: DEFAULT_LABELS.timeline,
      state: "next",
    },
    {
      stage: "binder",
      // Soft CLEAR: only claim "In their binder" when grant active+items known; else stay Sent.
      label: willJoinBinder ? "In their binder" : DEFAULT_LABELS.binder,
      state: willJoinBinder ? "next" : "idle",
    },
  ];
}

/** Build chip states for an evidence request on the survivor Requests tray. */
export function requestPipelineChips(status: string): PipelineChipModel[] {
  if (status === "submitted") {
    return [
      { stage: "request", label: DEFAULT_LABELS.request, state: "done" },
      { stage: "draft", label: DEFAULT_LABELS.draft, state: "done" },
      { stage: "timeline", label: "Sent", state: "done" },
      { stage: "binder", label: "In their binder", state: "done" },
    ];
  }
  if (status === "declined" || status === "passed") {
    return [
      { stage: "request", label: DEFAULT_LABELS.request, state: "done" },
      { stage: "draft", label: "Passed", state: "idle" },
      { stage: "timeline", label: DEFAULT_LABELS.timeline, state: "idle" },
      { stage: "binder", label: DEFAULT_LABELS.binder, state: "idle" },
    ];
  }
  // open / draft answer still private
  return [
    { stage: "request", label: DEFAULT_LABELS.request, state: "active" },
    { stage: "draft", label: "Private draft", state: "next" },
    { stage: "timeline", label: DEFAULT_LABELS.timeline, state: "idle" },
    { stage: "binder", label: DEFAULT_LABELS.binder, state: "idle" },
  ];
}

export function originChipLabel(opts: {
  fromRequest: boolean;
  model: string | null | undefined;
}): string {
  if (opts.fromRequest) return "From request";
  if (opts.model) return "AI organize";
  return "Soft upload";
}

export function PipelineStatusChips({
  chips,
  "aria-label": ariaLabel = "Where this sits",
}: {
  chips: PipelineChipModel[];
  "aria-label"?: string;
}) {
  const ordered = STAGE_ORDER.map((stage) => chips.find((c) => c.stage === stage)).filter(
    (c): c is PipelineChipModel => !!c,
  );

  return (
    <div className="pp-pipeline-chips" role="list" aria-label={ariaLabel}>
      {ordered.map((chip, i) => (
        <span key={chip.stage} className="inline-flex items-center gap-1.5" role="listitem">
          {i > 0 ? <span className="pp-pipeline-sep" aria-hidden="true">→</span> : null}
          <span className="pp-pipeline-chip" data-state={chip.state} data-stage={chip.stage}>
            {chip.label}
          </span>
        </span>
      ))}
    </div>
  );
}
