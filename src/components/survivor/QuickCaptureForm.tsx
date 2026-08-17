import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Lock } from "lucide-react";
import { saveQuickCapture } from "@/lib/quick-capture.functions";
import { DateCertaintyField, EMPTY_DATE_CERTAINTY, type DateCertaintyValue, deriveSortDate } from "@/components/pp/DateCertaintyField";
import { RECORD_TEMPLATES, SOURCE_TYPES, EXPECTATION_STATUSES, templateByKey } from "@/lib/record-templates";
import { AI_PERMISSIONS, AI_PERMISSION_LABELS, DEFAULT_AI_PERMISSION, type AiPermission } from "@/lib/ai-permissions";

type Kind = "event" | "expected";

interface Draft {
  kind: Kind;
  templateKey: string;
  description: string;
  when: DateCertaintyValue;
  sourceType: string;
  consequence: string;
  expectedItem: string;
  expectedDue: string;
  actualOutcome: string;
  actualOutcomeDate: string;
  expectationStatus: string;
  witnesses: string;
  sealed: boolean;
  aiPermission: AiPermission;
}

const EMPTY: Draft = {
  kind: "event",
  templateKey: "",
  description: "",
  when: { ...EMPTY_DATE_CERTAINTY, date_precision: "unknown" },
  sourceType: "",
  consequence: "",
  expectedItem: "",
  expectedDue: "",
  actualOutcome: "",
  actualOutcomeDate: "",
  expectationStatus: "open",
  witnesses: "",
  sealed: false,
  aiPermission: DEFAULT_AI_PERMISSION,
};

const LOCAL_KEY = "pp_quick_capture_draft_v1";

/**
 * One thing at a time. The only real requirement is that *something* was
 * written down; everything below the fold is optional and stays optional.
 */
export function QuickCaptureForm() {
  const navigate = useNavigate();
  const save = useServerFn(saveQuickCapture);
  const [d, setD] = useState<Draft>(EMPTY);
  const [showMore, setShowMore] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hydrated = useRef(false);

  // Restore an unfinished draft from this device so nothing is lost on exit.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) setD({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch { /* a corrupt draft is not worth surfacing */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* private mode */ }
  }, [d]);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const template = templateByKey(d.templateKey);
  const somethingWritten = !!(d.description.trim() || d.expectedItem.trim() || d.actualOutcome.trim());

  async function submit(asDraft: boolean) {
    if (!somethingWritten) {
      setStatus("error");
      setMessage("Write a line or two first — even a few words is enough.");
      return;
    }
    setStatus("saving");
    try {
      await save({
        data: {
          record_kind: d.kind,
          description: d.description,
          date: deriveSortDate(d.when),
          date_precision: d.when.date_precision,
          date_range_start: d.when.date_range_start || null,
          date_range_end: d.when.date_range_end || null,
          anchor_label: d.when.anchor_label || null,
          source_type: d.sourceType || null,
          practical_consequence: d.consequence || null,
          template_key: d.templateKey || null,
          expected_item: d.expectedItem || null,
          expected_due_date: d.expectedDue || null,
          actual_outcome: d.actualOutcome || null,
          actual_outcome_date: d.actualOutcomeDate || null,
          expectation_status: d.expectationStatus as Draft["expectationStatus"] as never,
          witnesses: d.witnesses || null,
          is_draft: asDraft,
          is_sealed: d.sealed,
          ai_permission: d.aiPermission,
        },
      });
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
      setStatus("saved");
      setMessage(asDraft ? "Saved as a draft. Come back to it whenever." : "Saved. Your record is safe.");
      setD(EMPTY);
      if (!asDraft) setTimeout(() => navigate({ to: "/journal" }), 900);
    } catch {
      setStatus("error");
      setMessage("We couldn't save that. Try again in a moment.");
    }
  }

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="label-eyebrow">What kind of record is this?</legend>
        <div className="flex flex-wrap gap-2">
          {([["event", "Something happened"], ["expected", "Something was supposed to happen"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ kind: v })}
              aria-pressed={d.kind === v}
              className="sv-choice"
              data-active={d.kind === v}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {d.kind === "expected" ? (
        <>
          <div>
            <label className="label-eyebrow" htmlFor="qc-expected">What was supposed to happen?</label>
            <input id="qc-expected" className="input-pp mt-1" value={d.expectedItem}
              onChange={(e) => set({ expectedItem: e.target.value })}
              placeholder="the 5pm pickup" />
          </div>
          <div>
            <label className="label-eyebrow" htmlFor="qc-actual">What actually happened?</label>
            <textarea id="qc-actual" className="input-pp mt-1" rows={3} value={d.actualOutcome}
              onChange={(e) => set({ actualOutcome: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-eyebrow" htmlFor="qc-due">Due or scheduled date (optional)</label>
              <input id="qc-due" type="date" className="input-pp mt-1" value={d.expectedDue}
                onChange={(e) => set({ expectedDue: e.target.value })} />
            </div>
            <div>
              <label className="label-eyebrow" htmlFor="qc-status">Where does it stand?</label>
              <select id="qc-status" className="input-pp mt-1" value={d.expectationStatus}
                onChange={(e) => set({ expectationStatus: e.target.value })}>
                {EXPECTATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="label-eyebrow" htmlFor="qc-desc">What happened?</label>
          <textarea id="qc-desc" className="input-pp mt-1" rows={5} value={d.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="A few words is fine. You can add more later." />
        </div>
      )}

      <DateCertaintyField value={d.when} onChange={(when) => set({ when })} label="When was this?" />

      <div>
        <label className="label-eyebrow" htmlFor="qc-consequence">What did it cost or change? (optional)</label>
        <input id="qc-consequence" className="input-pp mt-1" value={d.consequence}
          onChange={(e) => set({ consequence: e.target.value })}
          placeholder="missed a shift, paid it myself, had to reschedule" />
      </div>

      <button type="button" className="btn-ghost w-fit text-[13px]" onClick={() => setShowMore((s) => !s)}
        aria-expanded={showMore}>
        {showMore ? "Hide the optional details" : "Add optional details"}
      </button>

      {showMore && (
        <div className="grid gap-4 rounded-[16px] p-4" style={{ background: "var(--sv-tint)", border: "1px solid var(--sv-line)" }}>
          <div>
            <label className="label-eyebrow" htmlFor="qc-template">Use a template (optional)</label>
            <select id="qc-template" className="input-pp mt-1" value={d.templateKey}
              onChange={(e) => {
                const t = templateByKey(e.target.value);
                set({ templateKey: e.target.value, ...(t ? { kind: t.recordKind } : {}) });
              }}>
              <option value="">No template</option>
              {RECORD_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
            {template && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>{template.blurb}</p>
            )}
          </div>
          <div>
            <label className="label-eyebrow" htmlFor="qc-source">Where did this come from?</label>
            <select id="qc-source" className="input-pp mt-1" value={d.sourceType}
              onChange={(e) => set({ sourceType: e.target.value })}>
              <option value="">Not specified</option>
              {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow" htmlFor="qc-witnesses">Anyone else there?</label>
            <input id="qc-witnesses" className="input-pp mt-1" value={d.witnesses}
              onChange={(e) => set({ witnesses: e.target.value })} />
          </div>
          <div>
            <label className="label-eyebrow" htmlFor="qc-ai">How much processing do you allow on this record?</label>
            <select id="qc-ai" className="input-pp mt-1" value={d.aiPermission}
              onChange={(e) => set({ aiPermission: e.target.value as AiPermission })}>
              {AI_PERMISSIONS.map((p) => <option key={p} value={p}>{AI_PERMISSION_LABELS[p].title}</option>)}
            </select>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {AI_PERMISSION_LABELS[d.aiPermission].help}
            </p>
          </div>
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={d.sealed} onChange={(e) => set({ sealed: e.target.checked })} className="mt-1" />
            <span>
              <span className="inline-flex items-center gap-1 font-medium"><Lock size={13} /> Seal this record</span>
              <span className="block" style={{ color: "var(--muted-foreground)" }}>
                No preview, no processing, no grouping, and no professional access until you unlock it yourself.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => submit(false)}
          disabled={status === "saving"}>
          {status === "saving" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save it
        </button>
        <button type="button" className="btn-ghost" onClick={() => submit(true)} disabled={status === "saving"}>
          Save as a draft
        </button>
        {message && (
          <span role="status" className="text-[13px]"
            style={{ color: status === "error" ? "var(--sv-accent-700)" : "var(--muted-foreground)" }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

export default QuickCaptureForm;
