import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { courtPrepCoachFeedback } from "@/lib/prep/coach.functions";
import { markLessonProgress } from "@/lib/prep/study-profile.functions";

/**
 * Ephemeral practice box. Text is sent for feedback then cleared from React state.
 * Only binary module completion is persisted.
 */
export function PracticeCoachPanel({
  moduleId,
  practicePrompt,
  onCompleted,
}: {
  moduleId: string;
  practicePrompt: string;
  onCompleted?: () => void;
}) {
  const coachFn = useServerFn(courtPrepCoachFeedback);
  const progressFn = useServerFn(markLessonProgress);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const result = await coachFn({
        data: { module_id: moduleId, practice_text: text },
      });
      // Clear practice text immediately so it does not linger in the DOM.
      setDraft("");
      setReply(result.reply);
      if (result.persisted) {
        // Soft fail: coach must never claim persistence of practice text.
        setError("Unexpected persistence flag. Practice text should not be stored.");
      }
    } catch {
      setError("Could not get feedback just now. Your practice text was not saved.");
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const markDone = async () => {
    setBusy(true);
    try {
      await progressFn({ data: { module_id: moduleId, status: "completed" } });
      onCompleted?.();
    } catch {
      setError("Could not save progress. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 space-y-3" aria-labelledby="practice-heading">
      <h2 id="practice-heading" className="text-base font-semibold" style={{ color: "var(--pp-ink)" }}>
        Practice (not saved)
      </h2>
      <p className="text-sm" style={{ color: "var(--pp-muted)" }}>
        {practicePrompt}
      </p>
      <p className="text-xs" style={{ color: "var(--pp-muted)" }}>
        Your words are sent for feedback and then discarded. Only a completed checkbox is stored for
        this module.
      </p>
      <label className="block text-sm font-medium" htmlFor={`practice-${moduleId}`}>
        Practice box
      </label>
      <textarea
        id={`practice-${moduleId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
        rows={5}
        maxLength={4000}
        className="w-full rounded-xl border px-3 py-2 text-sm"
        style={{
          borderColor: "var(--pp-shadow-dark)",
          background: "var(--pp-ground)",
          color: "var(--pp-ink)",
        }}
        placeholder="Type a short practice answer. It will not be kept."
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-4 py-2 text-sm"
          onClick={() => void submit()}
          disabled={busy || !draft.trim()}
        >
          {busy ? "Working…" : "Get feedback"}
        </button>
        <button
          type="button"
          className="px-4 py-2 text-sm rounded-full border"
          style={{ borderColor: "var(--pp-ink)", color: "var(--pp-ink)" }}
          onClick={() => void markDone()}
          disabled={busy}
        >
          Mark module complete
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--pp-warning, #8A5A2E)" }}>
          {error}
        </p>
      )}
      {reply && (
        <div
          className="rounded-xl p-3 text-sm leading-relaxed"
          style={{ background: "var(--pp-card)", boxShadow: "var(--pp-shadow-sm)" }}
        >
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--pp-muted)" }}>
            Coach feedback (not stored)
          </p>
          <p style={{ color: "var(--pp-ink)", whiteSpace: "pre-wrap" }}>{reply}</p>
        </div>
      )}
    </section>
  );
}
