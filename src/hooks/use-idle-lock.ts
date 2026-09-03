import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "pointerdown",
] as const;

const DEFAULT_TIMEOUT_SEC = 60;
const MIN_TIMEOUT_SEC = 15;

/**
 * Locks the app after a period of no user activity.
 *
 * Someone may pick up the survivor's phone while it's open, so this has to be
 * real: any activity resets the countdown, and hiding the tab locks on the
 * next check rather than waiting out the full timeout.
 */
export function useIdleLock(enabled: boolean, timeoutSec: number, lock: () => void) {
  const lockRef = useRef(lock);
  lockRef.current = lock;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const seconds = Math.max(MIN_TIMEOUT_SEC, Number(timeoutSec) || DEFAULT_TIMEOUT_SEC);
    const ms = seconds * 1000;
    let last = Date.now();

    const bump = () => {
      last = Date.now();
    };

    // Interval polling instead of a rescheduled timeout: it survives timer
    // throttling in backgrounded tabs, where a long setTimeout may not fire.
    const interval = window.setInterval(() => {
      if (Date.now() - last >= ms) lockRef.current();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - last >= ms) lockRef.current();
        else bump();
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutSec]);
}
