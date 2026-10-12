import { supabase } from "@/integrations/supabase/client";
import { clearAppStorage, clearAppStorageAsync } from "@/lib/app-storage";

/**
 * The one sign-out path. Revokes the session, then wipes every app-owned key from this browser
 * (localStorage, sessionStorage, first-party cookies, IndexedDB, Cache Storage, service worker), the
 * same wipe Quick Exit does.
 *
 * Scope: supabase-js `signOut()` defaults to `scope: 'global'`, so a normal sign-out also ends this
 * account's sessions on other devices. That is the library default, kept as-is; see quick-exit.ts
 * for the tradeoff.
 *
 * Staged evidence files (pp-intake, #203's local-wipe) are cleared through clearAppStorageAsync,
 * which leaves the pending marker until they are confirmed gone.
 *
 * The wipe runs even if the network call fails: nothing should stay on the device either way.
 */
export async function signOutAndClearDevice(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* offline / already signed out — still clear the device */
  }
  clearAppStorage();
  try {
    await clearAppStorageAsync();
  } catch {
    /* ignore */
  }
}
