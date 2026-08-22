import { useState, useEffect } from 'react';

/**
 * App Disguise — "Daily Planner"
 * CRITICAL SAFETY FEATURE — NEVER modify without highest review.
 * When enabled, all branding swaps to "Daily Planner" with zero
 * DV-related language visible.
 */

const DISGUISE_KEY = 'patternproof_disguise';

export function useDisguise() {
  const [disguised, setDisguised] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DISGUISE_KEY) === 'true';
    setDisguised(stored);
    applyDisguise(stored);
  }, []);

  const toggle = (enabled: boolean) => {
    setDisguised(enabled);
    localStorage.setItem(DISGUISE_KEY, String(enabled));
    applyDisguise(enabled);
  };

  return { disguised, toggle };
}

function applyDisguise(enabled: boolean) {
  if (enabled) {
    document.title = 'Daily Planner';
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>';
    }
  } else {
    document.title = 'PatternProof';
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = '/favicon.svg';
    }
  }
}

export const APP_NAME = (): string => {
  return localStorage.getItem(DISGUISE_KEY) === 'true' ? 'Daily Planner' : 'PatternProof';
};
