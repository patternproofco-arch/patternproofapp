import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/lib/settings-context";
import {
  GUIDE_COPY,
  type DismissableState,
  type GuideInputs,
  type GuideMemory,
  type GuideState,
  guideMemoryKey,
  markQuickExitTried,
  notNow,
  pickGuideState,
  readJSON,
  settleOnReturn,
  startSuggestion,
  writeJSON,
} from "@/lib/home-guide";

const DISMISSABLE: GuideState[] = ["draft", "request", "quick-exit"];

/**
 * One guide card: eyebrow, one title, one line, one primary button. Quick Exit
 * stays in the shell header (top right); practice mode never really exits.
 */
export function HomeGuideCard({
  userId,
  inputs: rawInputs,
}: {
  userId: string;
  inputs: GuideInputs;
}) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const key = guideMemoryKey(userId);
  const [memory, setMemory] = useState<GuideMemory>(() => readJSON<GuideMemory>(key, {}));
  const [practicing, setPracticing] = useState(false);
  // Practice counts as trying Quick Exit even before Home re-reads storage.
  const [practiced, setPracticed] = useState(false);
  const inputs = useMemo(
    () =>
      practiced && !rawInputs.quickExitTried ? { ...rawInputs, quickExitTried: true } : rawInputs,
    [practiced, rawInputs],
  );

  // Returning Home: a suggestion she started and finished turns into the rest card.
  useEffect(() => {
    if (practicing) return;
    setMemory((m) => {
      const next = settleOnReturn(m, inputs);
      if (next !== m) writeJSON(key, next);
      return next;
    });
  }, [inputs, practicing, key]);

  const state = useMemo(() => pickGuideState(inputs, memory), [inputs, memory]);
  const copy = GUIDE_COPY[state];

  const save = (next: GuideMemory) => {
    setMemory(next);
    writeJSON(key, next);
  };

  const act = () => {
    save(startSuggestion(memory, state, inputs));
    if (state === "quick-exit") {
      markQuickExitTried();
      setPracticed(true);
      setPracticing(true);
      return;
    }
    if (copy.to) void navigate({ to: copy.to });
  };

  let exitHost = "a different site";
  try {
    exitHost = new URL(settings.exitUrl || "https://weather.com").hostname.replace(/^www\./, "");
  } catch {
    /* keep the generic wording */
  }

  return (
    <section
      aria-labelledby={practicing ? "qe-practice-title" : "home-guide-title"}
      className="pp-band pp-band--aqua pp-home-guide-card"
      data-testid="home-guide-card"
      data-state={state}
    >
      <div className="pp2-eyebrow">Start here</div>
      {practicing ? (
        <div role="dialog" aria-modal="false" aria-labelledby="qe-practice-title">
          <h2 id="qe-practice-title" className="pp2-title">
            This is practice.
          </h2>
          <p className="pp2-body">
            When you tap Quick exit at the top right, this page closes and {exitHost} opens right
            away, and you&apos;re signed out. Nothing happened just now.
          </p>
          <button
            type="button"
            className="pp2-primary"
            onClick={() => setPracticing(false)}
            data-testid="quick-exit-practice-done"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <>
          <h2 id="home-guide-title" className="pp2-title">
            {copy.title}
          </h2>
          <p className="pp2-body">{copy.line}</p>
          {copy.primary ? (
            <button type="button" className="pp2-primary" onClick={act}>
              {copy.action}
            </button>
          ) : (
            <Link
              to="/journal"
              onClick={() => save(startSuggestion(memory, state, inputs))}
              className="pp2-link"
            >
              {copy.action}
            </Link>
          )}
          {DISMISSABLE.includes(state) && (
            <button
              type="button"
              className="pp2-link"
              onClick={() => save(notNow(memory, state as DismissableState))}
            >
              Not now
            </button>
          )}
        </>
      )}
    </section>
  );
}
