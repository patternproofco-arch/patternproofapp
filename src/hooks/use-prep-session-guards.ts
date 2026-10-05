import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  PREP_INACTIVITY_PURGE_MS,
  PREP_PAUSE_OVERLAY_TEXT,
  PREP_SAFE_LANDING_PATH,
  PREP_VISIBILITY_PAUSE_MS,
} from "@/lib/prep/constants";
import { purgePrepSessionDrafts } from "@/lib/prep/session-county";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "pointerdown",
] as const;

/**
 * Spec v5 shared-device guards for /prep/*:
 * - Visibility/focus hidden >60s → pause overlay
 * - 5 minutes inactivity → purge session drafts + redirect to safe landing
 */
export function usePrepSessionGuards(enabled: boolean) {
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);
  const hiddenSince = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const pauseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const clearPauseTimer = () => {
      if (pauseTimer.current !== null) {
        window.clearTimeout(pauseTimer.current);
        pauseTimer.current = null;
      }
    };

    const bump = () => {
      lastActivity.current = Date.now();
    };

    const onHidden = () => {
      hiddenSince.current = Date.now();
      clearPauseTimer();
      pauseTimer.current = window.setTimeout(() => {
        setPaused(true);
      }, PREP_VISIBILITY_PAUSE_MS);
    };

    const onVisible = () => {
      hiddenSince.current = null;
      clearPauseTimer();
      // Overlay stays until click (spec: click anywhere to resume).
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHidden();
      else onVisible();
    };

    const onBlur = () => onHidden();
    const onFocus = () => onVisible();

    const inactivity = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= PREP_INACTIVITY_PURGE_MS) {
        purgePrepSessionDrafts();
        lastActivity.current = Date.now();
        setPaused(false);
        void navigate({ to: PREP_SAFE_LANDING_PATH, replace: true });
      }
    }, 1000);

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    if (document.visibilityState === "hidden") onHidden();

    return () => {
      clearPauseTimer();
      window.clearInterval(inactivity);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, navigate]);

  const resume = () => {
    setPaused(false);
    lastActivity.current = Date.now();
    hiddenSince.current = null;
  };

  return { paused, resume, pauseText: PREP_PAUSE_OVERLAY_TEXT };
}
