/**
 * Every piece of browser storage PatternProof writes, in one place.
 *
 * SAFETY RULES (Guardian gate):
 * - Quick Exit and sign-out must leave nothing of ours behind on the device. `clearAppStorage()`
 *   removes every localStorage / sessionStorage key whose NAME starts with an app-owned prefix,
 *   plus our first-party cookies. `clearAppStorageAsync()` also drops our IndexedDB databases,
 *   our Cache Storage caches and the service-worker registration.
 * - A key NAME must never contain a user id (or any other identifier). Someone looking at the
 *   browser's storage panel should not be able to read who signed in. Per-account data goes in the
 *   value, not the name.
 * - New keys belong in STORAGE_KEYS below and must start with an app-owned prefix. A unit test scans
 *   the source for storage writes and fails if a literal key is not covered.
 */
import {
  SESSION_COUNTY_KEY,
  SESSION_COURT_BRANCH_KEY,
  SESSION_INTAKE_DRAFT_KEY,
  SESSION_QUIET_TAB_KEY,
  SESSION_SAFETY_COPY_KEY,
} from "@/lib/prep/constants";
import { LOCAL_DATABASES, PENDING_WIPE_KEY, wipeLocalEvidence } from "@/lib/local-wipe";

/** Preferred prefix for new keys. */
export const APP_STORAGE_PREFIX = "pp.";

/** Persistent (localStorage) keys. */
export const LOCAL_KEYS = {
  /** Device settings: disguise name, Quick Exit destination, icon. Read by the pre-hydration exit. */
  settingsDevice: "pp_settings_v1",
  /** Account settings for whoever is signed in. Owner is a tag in the VALUE, never the name. */
  settingsAccount: "pp.settings.account.v2",
  /** Where she dragged the floating Exit button / record button. */
  exitPos: "pp.exit.pos",
  micPos: "pp.mic.pos",
  /** Live-recording consent warning already shown. */
  recordWarned: "pp_record_warned",
  /** Attorney caseload: clientId -> last opened (ids live in the value). */
  attorneyLastOpened: "pp.attorney.lastOpened",
} as const;

/** Tab-scoped (sessionStorage) keys. */
export const SESSION_KEYS = {
  oauthReturn: "pp_oauth_return",
  returnTo: "pp_return_to",
  passwordRecovery: "pp_password_recovery",
  unlockToken: "pp_unlock_token_v2",
  teamInvite: "pp.team_invite",
  attorneySecurityDismissed: "pp.att.security_dismissed",
  prepCounty: SESSION_COUNTY_KEY,
  prepCourtBranch: SESSION_COURT_BRANCH_KEY,
  prepIntakeDraft: SESSION_INTAKE_DRAFT_KEY,
  prepQuietTab: SESSION_QUIET_TAB_KEY,
  prepSafetyCopy: SESSION_SAFETY_COPY_KEY,
} as const;

/**
 * Names older builds wrote. Still cleared (and covered by the prefixes below) so a device updated
 * from an earlier version is not left holding them.
 * - `pp_settings_v1:<userId>` put the account id in the key name; replaced by settingsAccount.
 * - `patternproof-team-invite` / `att-security-dismissed` had no app prefix.
 */
export const LEGACY_KEY_PATTERNS = {
  accountSettingsByUserId: "pp_settings_v1:",
  teamInvite: "patternproof-team-invite",
  attorneySecurityDismissed: "att-security-dismissed",
} as const;

/**
 * Supabase auth (supabase-js default storage key `sb-<project-ref>-auth-token`, plus
 * `-code-verifier` for PKCE and `-user` when split user storage is on). The project ref is not a
 * user id. `supabase.auth.token` is the pre-v2 name.
 */
export const SUPABASE_AUTH_PREFIXES = ["sb-", "supabase.auth."] as const;

/** Every key whose name starts with one of these is ours and is removed on Quick Exit / sign-out. */
export const APP_OWNED_PREFIXES: readonly string[] = [
  "pp.",
  "pp_",
  "pp-",
  "patternproof",
  "att-",
  ...SUPABASE_AUTH_PREFIXES,
];

/** First-party cookies set on our origin (GA4, Stripe.js fraud cookies, shadcn sidebar, ours). */
export const APP_OWNED_COOKIE_PREFIXES: readonly string[] = [
  "_ga",
  "_gid",
  "_gat",
  "__stripe_mid",
  "__stripe_sid",
  "sidebar_state",
  "pp",
  "sb-",
];

/**
 * IndexedDB databases we create (evidence intake queue). Owned by local-wipe.ts (#203), which also
 * keeps the `pp_wipe_pending` marker so an interrupted removal is finished at the next app start.
 */
export const APP_INDEXED_DBS: readonly string[] = LOCAL_DATABASES;

/**
 * Keys the prefix wipe leaves in place on purpose. `pp_wipe_pending` (#203) holds only "1" and
 * must survive the wipe so an IndexedDB removal cut short by navigation is finished next start;
 * local-wipe.ts removes it once the databases are confirmed gone.
 */
export const WIPE_PRESERVED_KEYS: readonly string[] = [PENDING_WIPE_KEY];
/** Cache Storage names used by public/sw.js (`patternproof-<version>`). */
export const APP_CACHE_PREFIX = "patternproof-";

export function isAppOwnedKey(key: string): boolean {
  return APP_OWNED_PREFIXES.some((p) => key.startsWith(p));
}

function keysOf(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

function clearStorage(get: () => Storage): number {
  let removed = 0;
  try {
    const storage = get();
    for (const k of keysOf(storage)) {
      if (isAppOwnedKey(k) && !WIPE_PRESERVED_KEYS.includes(k)) {
        storage.removeItem(k);
        removed++;
      }
    }
  } catch {
    /* storage blocked / private mode */
  }
  return removed;
}

function clearCookies(): void {
  try {
    if (typeof document === "undefined" || !document.cookie) return;
    const host = window.location.hostname;
    const parts = host.split(".");
    const domains = ["", host, `.${host}`];
    // Also the registrable parent (GA sets `.pattern-proof.tech` from www.).
    if (parts.length > 2) domains.push(`.${parts.slice(-2).join(".")}`);
    for (const pair of document.cookie.split(";")) {
      const name = pair.split("=")[0]?.trim();
      if (!name || !APP_OWNED_COOKIE_PREFIXES.some((p) => name.startsWith(p))) continue;
      for (const d of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ""}`;
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Synchronous part of the wipe: runs before Quick Exit navigates away, so it always lands.
 * Returns how many storage keys were removed (for tests / diagnostics only).
 */
export function clearAppStorage(): number {
  if (typeof window === "undefined") return 0;
  const removed =
    clearStorage(() => window.localStorage) + clearStorage(() => window.sessionStorage);
  clearCookies();
  return removed;
}

/**
 * Asynchronous part: IndexedDB, Cache Storage, service worker. Quick Exit starts this and does not
 * wait for it (leaving must be instant); the browser carries the requests on after navigation in
 * practice, but that is not guaranteed. Sign-out awaits it.
 */
export async function clearAppStorageAsync(): Promise<void> {
  if (typeof window === "undefined") return;
  const tasks: Promise<unknown>[] = [];
  // Staged evidence (pp-intake): #203's wipe, which sets the pending marker and clears it once done.
  tasks.push(wipeLocalEvidence().catch(() => false));
  try {
    if (typeof indexedDB !== "undefined") {
      const names = new Set<string>();
      const listing = (
        indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> }
      ).databases;
      if (typeof listing === "function") {
        try {
          for (const db of await listing.call(indexedDB)) {
            if (db.name && isAppOwnedKey(db.name) && !APP_INDEXED_DBS.includes(db.name)) {
              names.add(db.name);
            }
          }
        } catch {
          /* listing unsupported */
        }
      }
      for (const name of names) {
        tasks.push(
          new Promise<void>((resolve) => {
            try {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              // A still-open connection blocks deletion until it closes; don't hang sign-out.
              req.onblocked = () => resolve();
            } catch {
              resolve();
            }
          }),
        );
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== "undefined") {
      tasks.push(
        caches
          .keys()
          .then((names) =>
            Promise.all(
              names.filter((n) => n.startsWith(APP_CACHE_PREFIX)).map((n) => caches.delete(n)),
            ),
          )
          .catch(() => undefined),
      );
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistrations) {
      tasks.push(
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => undefined),
      );
    }
  } catch {
    /* ignore */
  }
  await Promise.all(tasks);
}

/** Read the current Supabase access token (before the wipe) so Quick Exit can revoke it. */
export function readSupabaseAccessToken(): string | null {
  try {
    for (const k of keysOf(window.localStorage)) {
      if (!k.startsWith("sb-") || !k.endsWith("auth-token")) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        currentSession?: { access_token?: string };
      } | null;
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
      if (token) return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * The pre-hydration Quick Exit in __root.tsx is a plain inline script; it gets the same prefix
 * list from here so the two paths can't drift.
 */
export const INLINE_WIPE_CONFIG = {
  prefixes: APP_OWNED_PREFIXES,
  preserve: WIPE_PRESERVED_KEYS,
  cookiePrefixes: APP_OWNED_COOKIE_PREFIXES,
  indexedDbs: APP_INDEXED_DBS,
  cachePrefix: APP_CACHE_PREFIX,
};
