import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/lib/settings-context";
import { quickExit } from "@/lib/quick-exit";
import { Illustration } from "@/components/survivor/Illustration";
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
  sanitizeMemory,
  settleOnReturn,
  startSuggestion,
  writeJSON,
} from "@/lib/home-guide";

const DISMISSABLE: GuideState[] = ["draft", "request", "quick-exit"];

/**
 * One guide card: eyebrow, one title, one line, one primary button. Quick Exit
 * stays in the shell header (top right). Practice explains it, then "Try it now"
 * runs the real Quick Exit path (sign out + replace), the same as the header button.
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
  const [memory, setMemory] = useState<GuideMemory>(() =>
    sanitizeMemory(readJSON<unknown>(key, {})),
  );
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
      if (next !== m) writeJSON(key, sanitizeMemory(next));
      return next;
    });
  }, [inputs, practicing, key]);

  const state = useMemo(() => pickGuideState(inputs, memory), [inputs, memory]);
  const copy = GUIDE_COPY[state];

  const save = (next: GuideMemory) => {
    setMemory(next);
    writeJSON(key, sanitizeMemory(next));
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

  const museum = !practicing && (state === "first-mark" || state === "rest");
  return (
    <section
      aria-labelledby={practicing ? "qe-practice-title" : "home-guide-title"}
      className={`pp-home-guide-card ${museum ? "pp-museum pp-home-museum" : "pp-band pp-band--aqua"}`}
      data-testid="home-guide-card"
      data-state={state}
    >
      {!practicing && state === "first-mark" && (
        <Illustration name="thread-start" />
      )}
      {!practicing && state === "rest" && (
        <Illustration name="thread-rest" />
      )}
      <div className="pp2-eyebrow">Start here</div>
      {practicing ? (
        <div role="dialog" aria-modal="false" aria-labelledby="qe-practice-title">
          <h2 id="qe-practice-title" className="pp2-title">
            Here&apos;s what happens
          </h2>
          <p className="pp2-body">
            When you tap Quick exit at the top right, this page closes, {exitHost} opens right away,
            and you&apos;re signed out. To come back, open PatternProof and sign in.
          </p>
          <button
            type="button"
            className="pp2-primary"
            onClick={() => quickExit(settings.exitUrl)}
            data-testid="quick-exit-practice-try"
          >
            Try it now
          </button>
          <button
            type="button"
            className="pp2-link"
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
