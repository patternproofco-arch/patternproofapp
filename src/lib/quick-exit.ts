import { supabase } from "@/integrations/supabase/client";

/**
 * Quick Exit — a real sign-out, not just a redirect.
 *
 * Order matters. We synchronously destroy the persisted Supabase session in
 * localStorage FIRST, so that even if the network sign-out call never lands
 * (offline, slow, tab killed), reopening the app cannot restore the session.
 * The network sign-out is then fired best-effort and we never wait long for
 * it — leaving the screen quickly is the whole point of this button.
 *
 * What we deliberately keep: the user's PIN / biometric credential. Those are
 * protective settings the survivor chose; wiping them would make the app less
 * safe on the next visit, not more.
 *
 * What we cannot do: clear browser history, downloads, or OS notifications.
 */
export function quickExit(exitUrl?: string) {
  const url = exitUrl || "https://weather.com";

  // 0. Capture the access token BEFORE we destroy local storage, so we can
  //    still revoke it server-side afterwards.
  let accessToken: string | null = null;
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("sb-") && k.includes("auth-token")) {
        const raw = window.localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          accessToken = parsed?.access_token ?? parsed?.currentSession?.access_token ?? null;
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 1. Destroy the persisted auth token synchronously.
  try {
    Object.keys(window.localStorage).forEach((k) => {
      // Supabase persists as `sb-<project-ref>-auth-token`.
      if (k.startsWith("sb-") && k.includes("auth-token")) {
        window.localStorage.removeItem(k);
      }
    });
  } catch {
    /* ignore */
  }

  // 2. Clear transient PatternProof session state (PIN unlock, drafts, etc).
  //    Keys use both `pp.` and `pp_` prefixes (e.g. `pp_session_unlocked_v1`),
  //    so match on the bare `pp` prefix — missing the unlock flag would leave
  //    the app unlocked for whoever picks up the device next.
  try {
    Object.keys(window.sessionStorage).forEach((k) => {
      if (k.startsWith("pp.") || k.startsWith("pp_")) window.sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }

  // 3. Revoke the session server-side (global scope) so a copied/stale token
  //    cannot be replayed to restore access. Fired with `keepalive` so it
  //    survives the navigation below; never awaited.
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

  // 4. Neutralise the tab, then leave without leaving a back-button trail.
  try {
    document.title = "Weather";
  } catch {
    /* ignore */
  }
  try {
    window.history.replaceState(null, "", "/");
  } catch {
    /* ignore */
  }
  window.location.replace(url);
}
