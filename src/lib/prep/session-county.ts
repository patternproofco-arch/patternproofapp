/**
 * County / court branch: sessionStorage only (spec Tier 2).
 * Purged on logout, tab close (session end), Quick Exit (pp.* keys), and 5-min inactivity.
 * Never written to Supabase or localStorage.
 */

import {
  SESSION_COUNTY_KEY,
  SESSION_COURT_BRANCH_KEY,
  SESSION_INTAKE_DRAFT_KEY,
  SESSION_QUIET_TAB_KEY,
  SESSION_SAFETY_COPY_KEY,
} from "./constants";

function canUseSession(): boolean {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage;
  } catch {
    return false;
  }
}

export function getSessionCounty(): string {
  if (!canUseSession()) return "";
  try {
    return window.sessionStorage.getItem(SESSION_COUNTY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getSessionCourtBranch(): string {
  if (!canUseSession()) return "";
  try {
    return window.sessionStorage.getItem(SESSION_COURT_BRANCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSessionCounty(county: string): void {
  if (!canUseSession()) return;
  const v = county.trim().slice(0, 80);
  try {
    if (!v) window.sessionStorage.removeItem(SESSION_COUNTY_KEY);
    else window.sessionStorage.setItem(SESSION_COUNTY_KEY, v);
  } catch {
    /* ignore quota / private mode */
  }
}

export function setSessionCourtBranch(branch: string): void {
  if (!canUseSession()) return;
  const v = branch.trim().slice(0, 120);
  try {
    if (!v) window.sessionStorage.removeItem(SESSION_COURT_BRANCH_KEY);
    else window.sessionStorage.setItem(SESSION_COURT_BRANCH_KEY, v);
  } catch {
    /* ignore */
  }
}

/** Unfinished intake notes that must not sit in unencrypted localStorage. */
export function getSessionIntakeDraft(): string {
  if (!canUseSession()) return "";
  try {
    return window.sessionStorage.getItem(SESSION_INTAKE_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSessionIntakeDraft(text: string): void {
  if (!canUseSession()) return;
  const v = text.slice(0, 4000);
  try {
    if (!v.trim()) window.sessionStorage.removeItem(SESSION_INTAKE_DRAFT_KEY);
    else window.sessionStorage.setItem(SESSION_INTAKE_DRAFT_KEY, v);
  } catch {
    /* ignore */
  }
}

export function getQuietTabEnabled(): boolean {
  if (!canUseSession()) return false;
  try {
    return window.sessionStorage.getItem(SESSION_QUIET_TAB_KEY) === "1";
  } catch {
    return false;
  }
}

export function setQuietTabEnabled(on: boolean): void {
  if (!canUseSession()) return;
  try {
    if (on) window.sessionStorage.setItem(SESSION_QUIET_TAB_KEY, "1");
    else window.sessionStorage.removeItem(SESSION_QUIET_TAB_KEY);
  } catch {
    /* ignore */
  }
}

export type SafetyCopyVersion = "standard" | "short";

export function getSafetyCopyVersion(): SafetyCopyVersion {
  if (!canUseSession()) return "standard";
  try {
    return window.sessionStorage.getItem(SESSION_SAFETY_COPY_KEY) === "short"
      ? "short"
      : "standard";
  } catch {
    return "standard";
  }
}

export function setSafetyCopyVersion(v: SafetyCopyVersion): void {
  if (!canUseSession()) return;
  try {
    window.sessionStorage.setItem(SESSION_SAFETY_COPY_KEY, v);
  } catch {
    /* ignore */
  }
}

/** Clears Tier-2 session drafts. Quiet-tab preference is also cleared on purge. */
export function purgePrepSessionDrafts(): void {
  if (!canUseSession()) return;
  try {
    window.sessionStorage.removeItem(SESSION_COUNTY_KEY);
    window.sessionStorage.removeItem(SESSION_COURT_BRANCH_KEY);
    window.sessionStorage.removeItem(SESSION_INTAKE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function purgeCourtPrepSessionKeys(): void {
  purgePrepSessionDrafts();
  if (!canUseSession()) return;
  try {
    window.sessionStorage.removeItem(SESSION_QUIET_TAB_KEY);
    window.sessionStorage.removeItem(SESSION_SAFETY_COPY_KEY);
  } catch {
    /* ignore */
  }
}

export const COURT_PREP_SESSION_KEYS = [
  SESSION_COUNTY_KEY,
  SESSION_COURT_BRANCH_KEY,
  SESSION_INTAKE_DRAFT_KEY,
  SESSION_QUIET_TAB_KEY,
  SESSION_SAFETY_COPY_KEY,
] as const;
