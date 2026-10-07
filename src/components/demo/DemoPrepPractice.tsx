import { useEffect, useState } from "react";
import { Eraser } from "lucide-react";
import { DemoCard, demoButtonStyle } from "@/components/demo/DemoPortalShell";
import { STUDY_MODULES } from "@/lib/prep/modules-content";
import { DEMO_PRACTICE_NOTICE, DEMO_STATIC_COACH_SAMPLE } from "@/lib/demo/fixtures-prep";

/**
 * In-memory practice box for /demo/prep.
 * - Typed text lives in React state only: never stored, sent, logged, exported, or printed.
 * - Cleared on unmount (leaving the section or page), on page hide, and the moment
 *   Exit safely / Quick Exit is pressed (any [data-quick-exit] control, or Esc twice).
 * - Feedback is a fixed sample; the real practice coach (an authenticated AI call) is not used.
 */
export function DemoPrepPractice() {
  const [moduleId, setModuleId] = useState(STUDY_MODULES[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [showSample, setShowSample] = useState(false);
  const mod = STUDY_MODULES.find((m) => m.id === moduleId) ?? STUDY_MODULES[0];

  useEffect(() => {
    const clear = () => setDraft("");
    let lastEsc = 0;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && typeof target.closest === "function" && target.closest("[data-quick-exit]"))
        clear();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - lastEsc < 500) clear();
      lastEsc = now;
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pagehide", clear);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pagehide", clear);
      clear();
    };
  }, []);

  return (
    <div className="no-print" data-demo-practice="" style={{ display: "grid", gap: 16 }}>
      <style>{`@media print { [data-demo-practice] { display: none !important; } }`}</style>
      <p
        role="note"
        data-testid="demo-practice-notice"
        style={{
          margin: 0,
          padding: "10px 14px",
          borderRadius: 14,
          background: "var(--pp-ground-hi)",
          boxShadow: "var(--pp-shadow-in-sm)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--pp-warning)",
        }}
      >
        {DEMO_PRACTICE_NOTICE}
      </p>
      <DemoCard title="Practice a prompt">
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Module
          <select
            value={moduleId}
            onChange={(e) => {
              setModuleId(e.target.value);
              setDraft("");
              setShowSample(false);
            }}
            autoComplete="off"
            style={{ padding: 8, borderRadius: 10 }}
          >
            {STUDY_MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        {mod ? (
          <p style={{ margin: "12px 0 8px", fontSize: 14, lineHeight: 1.6 }}>
            {mod.practicePrompt}
          </p>
        ) : null}
        <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Your practice words (cleared when you leave)
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              rows={5}
              placeholder="Practice only. Use made-up words, not real details."
              style={{ padding: 10, borderRadius: 12, fontSize: 14, fontFamily: "inherit" }}
            />
          </label>
        </form>
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={demoButtonStyle} onClick={() => setDraft("")}>
            <Eraser size={14} /> Clear practice text
          </button>
          <button type="button" style={demoButtonStyle} onClick={() => setShowSample((v) => !v)}>
            {showSample ? "Hide sample feedback" : "Show sample feedback"}
          </button>
        </div>
      </DemoCard>
      {showSample ? (
        <DemoCard title="Sample feedback (static, not about what you typed)">
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--pp-muted)" }}>
            Sample prompt: {DEMO_STATIC_COACH_SAMPLE.prompt}
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            Sample answer: “{DEMO_STATIC_COACH_SAMPLE.sampleAnswer}”
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: "grid", gap: 4 }}>
            {DEMO_STATIC_COACH_SAMPLE.feedback.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--pp-muted)" }}>
            {DEMO_STATIC_COACH_SAMPLE.disclaimer}
          </p>
        </DemoCard>
      ) : null}
    </div>
  );
}
