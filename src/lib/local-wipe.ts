/**
 * Removing what this device is holding for the person.
 *
 * Files waiting to be uploaded sit in the browser's own storage (the "pp-intake" database) so a
 * dropped connection or a closed tab doesn't lose them. That makes them readable on the device by
 * the next person who picks it up. Quick Exit, a manual sign-out and a switch to another account
 * remove them. Server copies are untouched; this only clears what is staged on the device.
 *
 * Removal can be cut short when the page navigates away (Quick Exit does exactly that), so a marker
 * is left behind and finished the next time the app opens.
 */

export const LOCAL_DATABASES = ["pp-intake"] as const;
export const PENDING_WIPE_KEY = "pp_wipe_pending";

type Idb = Pick<IDBFactory, "deleteDatabase">;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Resolves when each database is gone, blocked, or failed. Never rejects, never waits forever. */
export function deleteLocalDatabases(idb: Idb | undefined, names: readonly string[] = LOCAL_DATABASES, timeoutMs = 3000) {
  if (!idb) return Promise.resolve(false);
  return Promise.all(
    names.map(
      (name) =>
        new Promise<boolean>((resolve) => {
          let done = false;
          const finish = (ok: boolean) => {
            if (!done) {
              done = true;
              resolve(ok);
            }
          };
          try {
            const req = idb.deleteDatabase(name);
            req.onsuccess = () => finish(true);
            req.onerror = () => finish(false);
            req.onblocked = () => finish(false);
          } catch {
            finish(false);
          }
          setTimeout(() => finish(false), timeoutMs);
        }),
    ),
  ).then((r) => r.every(Boolean));
}

export function markWipePending(store: Store | undefined): void {
  try {
    store?.setItem(PENDING_WIPE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export function wipePending(store: Store | undefined): boolean {
  try {
    return store?.getItem(PENDING_WIPE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Clears staged files now. The marker is removed only once they are confirmed gone. */
export async function wipeLocalEvidence(
  idb: Idb | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
  store: Store | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): Promise<boolean> {
  markWipePending(store);
  const ok = await deleteLocalDatabases(idb);
  if (ok) {
    try {
      store?.removeItem(PENDING_WIPE_KEY);
    } catch {
      /* ignore */
    }
  }
  return ok;
}

/** At app start: finish a wipe that was interrupted. */
export async function finishPendingWipe(
  idb: Idb | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
  store: Store | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): Promise<boolean> {
  if (!wipePending(store)) return false;
  return wipeLocalEvidence(idb, store);
}
