import { useEffect } from "react";

const SETTINGS_KEY = "pp_settings_v1";

/**
 * A handful of routes outside `_authenticated` — invite/accept links like
 * /survivor-invite/$token and /advocate-survivor-invite/$token — are reached
 * both by a brand-new visitor (no account yet) and by an already-signed-in
 * survivor navigating there mid-session (e.g. reviewing a pending invite
 * from /access). Those routes set their own route-level <title> ("An
 * attorney is inviting you — PatternProof"), which is correct for a new
 * visitor but overwrites her chosen disguise name the instant an existing
 * user lands there, with nothing to put it back — they sit outside
 * SettingsProvider entirely.
 *
 * Call this with `isAuthenticated` once auth state resolves. For a signed-in
 * user with a disguise on file, it restores that title. It never touches
 * the title for a new visitor (nothing in localStorage yet) or before auth
 * state is known, so the real page title still does its job of explaining
 * the invite to someone seeing it for the first time.
 */
export function useRestoreDisguiseTitle(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const disguiseName = (JSON.parse(raw) as { disguiseName?: string }).disguiseName;
      if (disguiseName) document.title = disguiseName;
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);
}
