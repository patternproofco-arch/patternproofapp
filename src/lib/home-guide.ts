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
  /** Used to pick the state only; never written to storage. */
  entries: number;
  /** created_at of her newest Note, if Home has loaded it. Used only in memory. */
  latestNoteAt?: string | null;
  draftWaiting: boolean;
  requestWaiting: boolean;
  quickExitTried: boolean;
};

/**
 * Local, per-account memory (localStorage). Only dates and the card's own state
 * names: no counts, titles, request or professional details (Guardian, #242).
 * Days are local YYYY-MM-DD; `since` is an ISO timestamp.
 */
export type GuideMemory = {
  /** Suggestion hidden by "Not now", and the day it was hidden. */
  dismissed?: Partial<Record<DismissableState, string>>;
  /** Day she finished a suggestion; the rest card stays for that day. */
  restDay?: string;
  /** The suggestion she started and when she tapped it. */
  pending?: { state: GuideState; day: string; since: string };
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const STATES: GuideState[] = ["first-mark", "draft", "request", "quick-exit", "default", "rest"];
const DISMISSABLE: DismissableState[] = ["draft", "request", "quick-exit"];

/** Keeps only the allowed shape: anything else read from storage is dropped. */
export function sanitizeMemory(raw: unknown): GuideMemory {
  const out: GuideMemory = {};
  if (!raw || typeof raw !== "object") return out;
  const m = raw as Record<string, unknown>;
  if (m.dismissed && typeof m.dismissed === "object") {
    const d: Partial<Record<DismissableState, string>> = {};
    for (const k of DISMISSABLE) {
      const v = (m.dismissed as Record<string, unknown>)[k];
      if (typeof v === "string" && DAY.test(v)) d[k] = v;
    }
    if (Object.keys(d).length) out.dismissed = d;
  }
  if (typeof m.restDay === "string" && DAY.test(m.restDay)) out.restDay = m.restDay;
  const p = m.pending as Record<string, unknown> | undefined;
  if (
    p &&
    STATES.includes(p.state as GuideState) &&
    typeof p.day === "string" &&
    DAY.test(p.day) &&
    typeof p.since === "string" &&
    ISO.test(p.since)
  )
    out.pending = { state: p.state as GuideState, day: p.day, since: p.since };
  return out;
}

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
  _inputs: GuideInputs,
  today = dayKey(),
  now: Date = new Date(),
): GuideMemory {
  return { ...memory, pending: { state, day: today, since: now.toISOString() } };
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
      ? !!inputs.latestNoteAt && Date.parse(inputs.latestNoteAt) > Date.parse(p.since)
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
const SALT_KEY = "pp.home.salt";

/** Per-device random salt, so keys never carry the raw user id. */
function deviceSalt(): string {
  try {
    let salt = window.localStorage.getItem(SALT_KEY);
    if (!salt) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      salt = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(SALT_KEY, salt);
    }
    return salt;
  } catch {
    return "nosalt";
  }
}

/** Salted, non-reversible tag for an account on this device (two 32-bit FNV-1a lanes). */
export function accountTag(userId: string, salt = deviceSalt()): string {
  const input = `${salt}:${userId}`;
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** "Show everything" is remembered per account (by tag). */
export const homeViewKey = (userId: string) => `${HOME_VIEW_KEY}.${accountTag(userId)}`;
export const guideMemoryKey = (userId: string) => `pp.home.guide.${accountTag(userId)}`;

/**
 * Quick Exit and sign-out remove every Home/guide key (pp.home*, pp.home.guide*),
 * including the device salt. pp.quickexit.tried and the dock version stay.
 */
export function clearHomeGuideStorage(storage: Storage = window.localStorage) {
  try {
    for (const k of Object.keys(storage)) if (k.startsWith("pp.home")) storage.removeItem(k);
  } catch {
    /* ignore */
  }
}

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

const UUID_TAIL = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Earlier builds keyed by raw user id; remove those keys. */
export function purgeLegacyHomeKeys(storage: Storage = window.localStorage) {
  try {
    for (const k of Object.keys(storage))
      if (k.startsWith("pp.home") && UUID_TAIL.test(k)) storage.removeItem(k);
  } catch {
    /* ignore */
  }
}
