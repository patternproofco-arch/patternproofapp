/**
 * Survivor Home: one guide card instead of the full view.
 *
 * Picks the first true state from data Home already loads (dashboard stats) plus
 * small local flags. Copy rules: no counts, no checklist or progress, no "you
 * haven't…", no deadlines. Never suggests sharing, inviting, AI assistance or export.
 */

export type GuideState = "first-mark" | "draft" | "request" | "quick-exit" | "default" | "rest";
/** States that offer "Not now". */
export type DismissableState = "draft" | "request" | "quick-exit";

export type GuideCopy = {
  title: string;
  line: string;
  /** Primary action; the rest card uses a quiet secondary link instead. */
  action: string;
  to: "/journal" | "/drafts" | "/requests" | null;
  primary: boolean;
};

export const GUIDE_COPY: Record<GuideState, GuideCopy> = {
  "first-mark": {
    title: "Add your first Note",
    line: "A sentence or two is enough. It stays private unless you choose to share.",
    action: "Add a Note",
    to: "/journal",
    primary: true,
  },
  draft: {
    title: "Look over your draft",
    line: "Something you saved is ready to read. You decide what stays.",
    action: "Read draft",
    to: "/drafts",
    primary: true,
  },
  request: {
    title: "Someone asked you for something",
    line: "You choose whether to answer, and what to include.",
    action: "See request",
    to: "/requests",
    primary: true,
  },
  "quick-exit": {
    title: "Try Quick Exit once",
    line: "It's the button at the top right. It takes you to a different site right away. Practice, then come back.",
    action: "Practice Quick Exit",
    to: null,
    primary: true,
  },
  default: {
    title: "Add what happened, then rest",
    line: "You don't have to do it all today.",
    action: "Add a Note",
    to: "/journal",
    primary: true,
  },
  rest: {
    title: "That's enough for today.",
    line: "Come back whenever you want.",
    action: "Add another Note",
    to: "/journal",
    primary: false,
  },
};

/** What Home knows. `requestWaiting` is false until Home loads requests. */
export type GuideInputs = {
  entries: number;
  draftWaiting: boolean;
  requestWaiting: boolean;
  quickExitTried: boolean;
};

/** Local, per-account memory (localStorage). Days are local YYYY-MM-DD. */
export type GuideMemory = {
  /** Suggestion hidden by "Not now", and the day it was hidden. */
  dismissed?: Partial<Record<DismissableState, string>>;
  /** Day she finished a suggestion; the rest card stays for that day. */
  restDay?: string;
  /** The suggestion she started, the day, and the entry count when she tapped. */
  pending?: { state: GuideState; day: string; entries: number };
};

export function dayKey(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function suggestion(inputs: GuideInputs): DismissableState | null {
  if (inputs.draftWaiting) return "draft";
  if (inputs.requestWaiting) return "request";
  if (!inputs.quickExitTried) return "quick-exit";
  return null;
}

/** First true state wins. "Not now" on 2–4 hides it for today and shows the default. */
export function pickGuideState(
  inputs: GuideInputs,
  memory: GuideMemory,
  today = dayKey(),
): GuideState {
  if (memory.restDay === today) return "rest";
  if (inputs.entries <= 0) return "first-mark";
  const s = suggestion(inputs);
  if (s && memory.dismissed?.[s] !== today) return s;
  return "default";
}

/** "Not now": hide this suggestion until tomorrow. */
export function notNow(
  memory: GuideMemory,
  state: DismissableState,
  today = dayKey(),
): GuideMemory {
  return { ...memory, dismissed: { ...memory.dismissed, [state]: today } };
}

/** She tapped the card's main action. */
export function startSuggestion(
  memory: GuideMemory,
  state: GuideState,
  inputs: GuideInputs,
  today = dayKey(),
): GuideMemory {
  return { ...memory, pending: { state, day: today, entries: inputs.entries } };
}

/** On returning Home: if the started suggestion is now done, rest for the day. */
export function settleOnReturn(
  memory: GuideMemory,
  inputs: GuideInputs,
  today = dayKey(),
): GuideMemory {
  const p = memory.pending;
  if (!p) return memory;
  if (p.day !== today) return { ...memory, pending: undefined };
  const done =
    p.state === "first-mark" || p.state === "default" || p.state === "rest"
      ? inputs.entries > p.entries
      : p.state === "draft"
        ? !inputs.draftWaiting
        : p.state === "request"
          ? !inputs.requestWaiting
          : inputs.quickExitTried;
  return done ? { ...memory, pending: undefined, restDay: today } : memory;
}

// ---- storage -------------------------------------------------------------

export const QUICK_EXIT_TRIED_KEY = "pp.quickexit.tried";
export const HOME_VIEW_KEY = "pp.home.view";
/** "Show everything" is remembered per account; the bare key is a legacy fallback. */
export const homeViewKey = (userId: string) => `${HOME_VIEW_KEY}.${userId}`;
export const guideMemoryKey = (userId: string) => `pp.home.guide.${userId}`;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the card still works for this visit */
  }
}

export function markQuickExitTried() {
  try {
    window.localStorage.setItem(QUICK_EXIT_TRIED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function quickExitTried() {
  try {
    return window.localStorage.getItem(QUICK_EXIT_TRIED_KEY) === "1";
  } catch {
    return false;
  }
}
