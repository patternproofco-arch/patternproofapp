import { supabase } from "@/integrations/supabase/client";
import { markWipePending, wipeLocalEvidence } from "@/lib/local-wipe";
import { clearAppStorage, clearAppStorageAsync, readSupabaseAccessToken } from "@/lib/app-storage";

export const DEFAULT_EXIT_URL = "https://weather.com";

/**
 * Leave right now: wipe everything of ours from this browser, revoke the session, cover the page,
 * and replace the location so Back doesn't return here.
 *
 * Order matters:
 * 1. Read the access token (needed to revoke it) BEFORE the wipe.
 * 2. Wipe every app-owned localStorage / sessionStorage key + first-party cookies (synchronous, so it
 *    always lands before navigation). This includes device settings (disguise, exit destination)
 *    and the Supabase `sb-*` keys.
 * 3. Kick off the async wipe (IndexedDB intake queue, Cache Storage, service worker) without
 *    waiting for it.
 * 4. Revoke the session server-side. SCOPE IS 'global' — deliberate (see note below).
 *
 * Session revocation scope: `global` signs out EVERY session for this account (all devices), not
 * just this browser. Benefit: if an abuser has her password or a logged-in device, Quick Exit also
 * kicks them out. Cost: her own other devices (e.g. a safe phone) are signed out too, and she has to
 * sign in again there. Do not change to 'local' without a Guardian decision.
 */
export function quickExit(exitUrl?: string) {
  const url = exitUrl || DEFAULT_EXIT_URL;

  // Tell any beforeunload guards (e.g. the journal draft warning) to stand down:
  // leaving right now is the whole point of this button.
  try {
    (window as unknown as { __ppQuickExit?: boolean }).__ppQuickExit = true;
  } catch {
    /* ignore */
  }

  const accessToken = readSupabaseAccessToken();

  clearAppStorage();

  try {
    void clearAppStorageAsync().catch(() => undefined);
  } catch {
    /* ignore */
  }

  // Files staged on this device for upload go too (#203). The page is about to be replaced, which
  // can interrupt the removal, so the marker (kept by clearAppStorage) makes the next app start
  // finish it.
  try {
    markWipePending(window.localStorage);
    void wipeLocalEvidence();
  } catch {
    /* ignore */
  }

  try {
    void supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  } catch {
    /* ignore */
  }
  try {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (accessToken && base && apikey) {
      void fetch(`${base}/auth/v1/logout?scope=global`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }

  try {
    document.title = "Weather";
    document.documentElement.replaceChildren();
    const cover = document.createElement("body");
    cover.setAttribute("style", "margin:0;background:#fff;min-height:100vh");
    document.documentElement.appendChild(cover);
  } catch {
    /* ignore */
  }
  window.location.replace(url);
}
