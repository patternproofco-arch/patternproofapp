import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCAL_DATABASES,
  PENDING_WIPE_KEY,
  deleteLocalDatabases,
  finishPendingWipe,
  markWipePending,
  wipeLocalEvidence,
  wipePending,
} from "@/lib/local-wipe";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    has: (k: string) => m.has(k),
  };
}

/** An IndexedDB stand-in whose deleteDatabase answers the way we tell it to. */
function fakeIdb(outcome: "success" | "error" | "blocked" | "throw" | "hang") {
  const deleted: string[] = [];
  return {
    deleted,
    deleteDatabase(name: string) {
      if (outcome === "throw") throw new Error("denied");
      const req: Record<string, unknown> = {};
      deleted.push(name);
      if (outcome !== "hang") {
        queueMicrotask(() => {
          const cb = req[outcome === "success" ? "onsuccess" : outcome === "error" ? "onerror" : "onblocked"] as (() => void) | undefined;
          cb?.();
        });
      }
      return req as unknown as IDBOpenDBRequest;
    },
  };
}

describe("clearing files staged on the device", () => {
  it("removes the upload queue database and reports success", async () => {
    const idb = fakeIdb("success");
    expect(await deleteLocalDatabases(idb)).toBe(true);
    expect(idb.deleted).toEqual([...LOCAL_DATABASES]);
    expect(LOCAL_DATABASES).toContain("pp-intake");
  });

  it("never throws or waits forever when removal fails, is blocked, or hangs", async () => {
    for (const o of ["error", "blocked", "throw"] as const) {
      expect(await deleteLocalDatabases(fakeIdb(o))).toBe(false);
    }
    expect(await deleteLocalDatabases(fakeIdb("hang"), LOCAL_DATABASES, 20)).toBe(false);
    expect(await deleteLocalDatabases(undefined)).toBe(false);
  });

  it("keeps a marker until the files are confirmed gone, then clears it", async () => {
    const store = fakeStore();
    expect(await wipeLocalEvidence(fakeIdb("blocked"), store)).toBe(false);
    expect(wipePending(store)).toBe(true);
    expect(await wipeLocalEvidence(fakeIdb("success"), store)).toBe(true);
    expect(store.has(PENDING_WIPE_KEY)).toBe(false);
  });

  it("finishes an interrupted wipe at the next start, and does nothing otherwise", async () => {
    const idb = fakeIdb("success");
    const clean = fakeStore();
    expect(await finishPendingWipe(idb, clean)).toBe(false);
    expect(idb.deleted).toEqual([]);

    const interrupted = fakeStore();
    markWipePending(interrupted);
    expect(await finishPendingWipe(idb, interrupted)).toBe(true);
    expect(idb.deleted).toEqual([...LOCAL_DATABASES]);
    expect(wipePending(interrupted)).toBe(false);
  });
});

describe("where it runs (source contract)", () => {
  it("Quick Exit, the early Quick Exit script, a manual sign-out and an account switch all clear it", () => {
    expect(read("lib/quick-exit.ts")).toMatch(/wipeLocalEvidence\(\)/);
    expect(read("lib/quick-exit.ts")).toMatch(/markWipePending/);
    expect(read("routes/__root.tsx")).toMatch(/indexedDB\.deleteDatabase\("pp-intake"\)/);
    expect(read("routes/__root.tsx")).toMatch(/pp_wipe_pending/);
    expect(read("components/UtilityBar.tsx")).toMatch(/wipeLocalEvidence\(\)/);
    expect(read("lib/auth-context.tsx")).toMatch(/finishPendingWipe\(\)/);
    expect(read("lib/auth-context.tsx")).toMatch(/lastUserId\.current && nextId\) void wipeLocalEvidence\(\)/);
  });

  it("an expired session alone does not throw away files waiting to upload", () => {
    const auth = read("lib/auth-context.tsx");
    // Wiping happens only when one signed-in account is replaced by another, never on sign-out events.
    expect(auth).not.toMatch(/SIGNED_OUT/);
  });

  it("the early script's database name matches the queue's", () => {
    expect(read("lib/intake-queue.ts")).toMatch(/DB_NAME = "pp-intake"/);
  });
});
