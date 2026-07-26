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
  try {
    Object.keys(window.sessionStorage).forEach((k) => {
      if (k.startsWith("pp.")) window.sessionStorage.removeItem(k);
    });
  } catch {
    /* ignore */
  }

  // 3. Best-effort server-side sign-out. Not awaited past a short deadline.
  try {
    void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
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
