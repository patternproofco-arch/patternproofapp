// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));

import {
  APP_CACHE_PREFIX,
  APP_INDEXED_DBS,
  APP_OWNED_PREFIXES,
  LEGACY_KEY_PATTERNS,
  LOCAL_KEYS,
  SESSION_KEYS,
  clearAppStorage,
  clearAppStorageAsync,
  isAppOwnedKey,
} from "@/lib/app-storage";
import { quickExit } from "@/lib/quick-exit";
import { signOutAndClearDevice } from "@/lib/sign-out";
import { SETTINGS_KEY } from "@/lib/settings-scope";

const ROOT = `${process.cwd()}/`;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const USER_ID = "3f1c2a9e-1111-4222-8333-444455556666";

/** Every key name PatternProof writes or has written (current + legacy + Supabase auth). */
function allKnownLocal(): string[] {
  return [
    ...Object.values(LOCAL_KEYS),
    `${LEGACY_KEY_PATTERNS.accountSettingsByUserId}${USER_ID}`,
    "sb-muyfixtureref-auth-token",
    "sb-muyfixtureref-auth-token-code-verifier",
    "sb-muyfixtureref-auth-token-user",
    "supabase.auth.token",
  ];
}
function allKnownSession(): string[] {
  return [
    ...Object.values(SESSION_KEYS),
    LEGACY_KEY_PATTERNS.teamInvite,
    LEGACY_KEY_PATTERNS.attorneySecurityDismissed,
  ];
}

function seed() {
  for (const k of allKnownLocal()) localStorage.setItem(k, JSON.stringify({ access_token: "t", v: 1 }));
  for (const k of allKnownSession()) sessionStorage.setItem(k, "1");
  localStorage.setItem("unrelated-third-party", "keep");
  sessionStorage.setItem("unrelated-third-party", "keep");
  document.cookie = "_ga=GA1.1.123; path=/";
  document.cookie = "_ga_PXNVVNXEV5=GS1.1; path=/";
}

function appKeysLeft(): string[] {
  const left: string[] = [];
  for (const s of [localStorage, sessionStorage]) {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)!;
      if (isAppOwnedKey(k)) left.push(k);
    }
  }
  return left;
}

let deleteDatabase: ReturnType<typeof vi.fn>;
let cacheDelete: ReturnType<typeof vi.fn>;
let unregister: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  deleteDatabase = vi.fn(() => {
    const req: { onsuccess?: () => void } = {};
    queueMicrotask(() => req.onsuccess?.());
    return req;
  });
  cacheDelete = vi.fn(async () => true);
  unregister = vi.fn(async () => true);
  vi.stubGlobal("indexedDB", {
    deleteDatabase,
    databases: async () => [{ name: "pp-intake" }, { name: "someone-elses-db" }],
  });
  vi.stubGlobal("caches", {
    keys: async () => ["patternproof-v7-prep-no-store", "patternproof-v6", "other-cache"],
    delete: cacheDelete,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistrations: async () => [{ unregister }] },
  });
  vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Quick Exit / sign-out leave nothing of ours on the device", () => {
  it("the seed really covers every known key (sanity)", () => {
    seed();
    expect(appKeysLeft().length).toBe(allKnownLocal().length + allKnownSession().length);
  });

  it("Quick Exit removes every app-owned localStorage + sessionStorage key and GA cookies", () => {
    seed();
    try {
      quickExit("https://weather.com");
    } catch {
      /* jsdom: navigation not implemented */
    }
    expect(appKeysLeft()).toEqual([]);
    // Prefix discipline: not a blanket clear of keys that aren't ours.
    expect(localStorage.getItem("unrelated-third-party")).toBe("keep");
    expect(document.cookie).not.toMatch(/_ga/);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("Quick Exit starts the IndexedDB / Cache Storage / service-worker wipe", async () => {
    seed();
    try {
      quickExit();
    } catch {
      /* ignore */
    }
    await vi.waitFor(() => expect(cacheDelete).toHaveBeenCalledTimes(2));
    expect(cacheDelete).toHaveBeenCalledWith("patternproof-v7-prep-no-store");
    expect(cacheDelete).not.toHaveBeenCalledWith("other-cache");
    expect(deleteDatabase).toHaveBeenCalledWith("pp-intake");
    expect(deleteDatabase).not.toHaveBeenCalledWith("someone-elses-db");
    await vi.waitFor(() => expect(unregister).toHaveBeenCalled());
  });

  it("sign-out removes every app-owned key, IndexedDB queue and caches", async () => {
    seed();
    await signOutAndClearDevice();
    expect(mocks.signOut).toHaveBeenCalled();
    expect(appKeysLeft()).toEqual([]);
    expect(deleteDatabase).toHaveBeenCalledWith("pp-intake");
    expect(cacheDelete).toHaveBeenCalledWith("patternproof-v6");
  });

  it("sign-out still wipes the device when the network sign-out fails", async () => {
    seed();
    mocks.signOut.mockRejectedValueOnce(new Error("offline"));
    await signOutAndClearDevice();
    expect(appKeysLeft()).toEqual([]);
  });

  it("clearAppStorage + clearAppStorageAsync are safe with storage APIs missing", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("caches", undefined);
    expect(() => clearAppStorage()).not.toThrow();
    await expect(clearAppStorageAsync()).resolves.toBeUndefined();
  });

  it("the intake queue database and service-worker cache names are on the wipe list", () => {
    expect(read("src/lib/intake-queue.ts")).toMatch(/const DB_NAME = "pp-intake"/);
    expect(APP_INDEXED_DBS).toContain("pp-intake");
    expect(read("public/sw.js")).toMatch(/const CACHE_NAME = `patternproof-\$\{CACHE_VERSION\}`/);
    expect(APP_CACHE_PREFIX).toBe("patternproof-");
  });
});

// ---------- source scans: inventory can't silently drift ----------

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "routeTree.gen.ts") {
      out.push(p);
    }
  }
  return out;
}
const SRC_FILES = walk(join(ROOT, "src"));

/** First argument of every storage write / draggable key in the app source. */
function storageKeyArgs(): Array<{ file: string; arg: string }> {
  const found: Array<{ file: string; arg: string }> = [];
  const re = /(?:localStorage|sessionStorage)\.setItem\(\s*([^,]+?)\s*,|useDraggable\(\s*([^,]+?)\s*,/g;
  for (const file of SRC_FILES) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) found.push({ file: file.slice(ROOT.length), arg: (m[1] ?? m[2])!.trim() });
  }
  return found;
}

describe("storage key inventory", () => {
  it("every literal storage key in the source starts with an app-owned prefix", () => {
    const bad = storageKeyArgs().filter(({ arg }) => {
      const lit = /^["'`]([^"'`$]*)["'`]$/.exec(arg);
      return lit ? !isAppOwnedKey(lit[1]!) : false;
    });
    expect(bad).toEqual([]);
  });

  it("every centralized key starts with an app-owned prefix", () => {
    for (const k of [...Object.values(LOCAL_KEYS), ...Object.values(SESSION_KEYS)]) {
      expect(isAppOwnedKey(k), k).toBe(true);
    }
    expect(APP_OWNED_PREFIXES).toEqual(expect.arrayContaining(["pp.", "pp_", "sb-"]));
  });

  it("no key-name template includes a user id", () => {
    // No storage write uses a template/concatenated key built from an id.
    const dynamic = storageKeyArgs().filter(({ arg }) => /\$\{|\+/.test(arg));
    expect(dynamic).toEqual([]);
    // No storage read/write/remove, and no *Key / *_KEY constant, builds its name from an id.
    const idInKey: string[] = [];
    const patterns = [
      /(?:localStorage|sessionStorage|storage)\.(?:getItem|setItem|removeItem)\(\s*`[^`]*\$\{[^`]*`/g,
      /(?:[A-Za-z]*Key|[A-Z_]*_KEY)\s*=\s*(?:\([^)]*\)\s*=>\s*)?`(?:pp[._-]|patternproof|sb-|\$\{[A-Z_]*KEY\}|\$\{APP_STORAGE_PREFIX\})[^`]*\$\{[^}]*(?:user|uid|\bid\b|Id\b)[^}]*\}[^`]*`/g,
    ];
    // Self-check: the scan flags the shape the old build used.
    const oldShape = "export const accountSettingsKey = (userId: string) => `${SETTINGS_KEY}:${userId}`;";
    expect(patterns.some((re) => new RegExp(re.source).test(oldShape))).toBe(true);
    for (const file of SRC_FILES) {
      const src = readFileSync(file, "utf8");
      for (const re of patterns) for (const m of src.matchAll(re)) idInKey.push(`${file.slice(ROOT.length)}: ${m[0]}`);
    }
    expect(idInKey).toEqual([]);
    // Static values: none look like an id or carry a ':<id>' suffix.
    for (const k of [...Object.values(LOCAL_KEYS), ...Object.values(SESSION_KEYS)]) {
      expect(k).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|:/i);
    }
    expect(read("src/lib/settings-scope.ts")).not.toMatch(/accountSettingsKey = \(userId/);
    expect(SETTINGS_KEY).toBe("pp_settings_v1");
  });

  it("every sign-out goes through the wiping helper", () => {
    const offenders = SRC_FILES.filter((f) => /supabase\.auth\.signOut\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(ROOT.length))
      .filter((f) => f !== "src/lib/sign-out.ts" && f !== "src/lib/quick-exit.ts");
    expect(offenders).toEqual([]);
  });

  it("the pre-hydration Quick Exit uses the same prefix list and wipes both storages", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toMatch(/var WIPE = \$\{JSON\.stringify\(INLINE_WIPE_CONFIG\)\}/);
    expect(root).toMatch(/wipe\(localStorage\)/);
    expect(root).toMatch(/wipe\(sessionStorage\)/);
    expect(root).toMatch(/wipeAsync\(\)/);
  });

  it("Quick Exit revocation scope is global (deliberate; documented tradeoff)", () => {
    expect(read("src/lib/quick-exit.ts")).toMatch(/signOut\(\{ scope: "global" \}\)/);
    expect(read("src/lib/quick-exit.ts")).toMatch(/Do not change to 'local' without a Guardian decision/);
  });
});
