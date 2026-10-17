// Guardian conditions for #242: (a) storage shape, (b) no raw user id in keys,
// (c) Quick Exit and sign-out clear Home/guide keys, (d) practice uses the real exit path.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountTag,
  clearHomeGuideStorage,
  guideMemoryKey,
  homeViewKey,
  notNow,
  purgeLegacyHomeKeys,
  sanitizeMemory,
  settleOnReturn,
  startSuggestion,
} from "@/lib/home-guide";

const UID = "3f9b2c1e-8a7d-4e6f-9b0a-1c2d3e4f5a6b";
const T = "2026-10-15";
const base = { entries: 3, draftWaiting: true, requestWaiting: false, quickExitTried: false };

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
function storage() {
  const s = new MemStorage();
  // Object.keys(storage) must list keys, like the browser's Storage.
  return new Proxy(s, {
    ownKeys: (t) => [...(t as unknown as { m: Map<string, string> }).m.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  }) as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: storage() });
});

describe("(a) guide memory holds only dates and the card's state names", () => {
  it("everything written is a date, an ISO time or a state name", () => {
    let m = notNow({}, "draft", T);
    m = notNow(m, "quick-exit", T);
    m = startSuggestion(m, "request", base, T, new Date("2026-10-15T10:00:00Z"));
    m = settleOnReturn(m, base, T);
    const json = JSON.stringify(sanitizeMemory(m));
    const values = JSON.parse(json, (_k, v) => v);
    const flat: unknown[] = [];
    const walk = (v: unknown) =>
      v && typeof v === "object" ? Object.values(v).forEach(walk) : flat.push(v);
    walk(values);
    for (const v of flat)
      expect(String(v)).toMatch(
        /^(\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?|first-mark|draft|request|quick-exit|default|rest)$/,
      );
    expect(json).not.toMatch(/entries|count|title|attorney|advocate|"\d+"|:\d+[,}]/);
  });
  it("drops anything else found in storage (counts, titles, request details)", () => {
    const dirty = {
      dismissed: { draft: T, request: "Attorney J. Smith asked for texts" },
      restDay: T,
      pending: { state: "first-mark", day: T, entries: 4, since: "2026-10-15T10:00:00.000Z" },
      title: "what happened on Friday",
      count: 12,
    };
    expect(sanitizeMemory(dirty)).toEqual({
      dismissed: { draft: T },
      restDay: T,
      pending: { state: "first-mark", day: T, since: "2026-10-15T10:00:00.000Z" },
    });
    expect(sanitizeMemory({ pending: { state: "evil", day: T, since: "x" } })).toEqual({});
  });
});

describe("(b) keys never contain the raw user id", () => {
  it("uses a salted per-device tag", () => {
    expect(guideMemoryKey(UID)).not.toContain(UID);
    expect(homeViewKey(UID)).not.toContain(UID);
    expect(guideMemoryKey(UID)).toMatch(/^pp\.home\.guide\.[0-9a-f]{16}$/);
    // Stable on one device, different per account and per device salt.
    expect(guideMemoryKey(UID)).toBe(guideMemoryKey(UID));
    expect(accountTag(UID, "a")).not.toBe(accountTag(UID, "b"));
    expect(accountTag(UID, "a")).not.toBe(accountTag("someone-else", "a"));
    for (let i = 0; i < window.localStorage.length; i++)
      expect(window.localStorage.key(i)).not.toContain(UID);
  });
  it("removes legacy keys that carried the raw id", () => {
    const ls = window.localStorage;
    ls.setItem(`pp.home.guide.${UID}`, "{}");
    ls.setItem(`pp.home.view.${UID}`, "all");
    ls.setItem("pp.quickexit.tried", "1");
    purgeLegacyHomeKeys(ls);
    expect(ls.getItem(`pp.home.guide.${UID}`)).toBeNull();
    expect(ls.getItem(`pp.home.view.${UID}`)).toBeNull();
    expect(ls.getItem("pp.quickexit.tried")).toBe("1");
  });
});

describe("(c) Quick Exit and sign-out clear Home/guide keys", () => {
  it("clearHomeGuideStorage removes pp.home* and keeps quickexit.tried and the dock version", () => {
    const ls = window.localStorage;
    ls.setItem(guideMemoryKey(UID), "{}");
    ls.setItem(homeViewKey(UID), "all");
    ls.setItem("pp.home.view", "all");
    ls.setItem("pp.quickexit.tried", "1");
    ls.setItem("pp.exit.dock.v", "2");
    clearHomeGuideStorage(ls);
    const left = Array.from({ length: ls.length }, (_, i) => ls.key(i));
    expect(left.filter((k) => k!.startsWith("pp.home"))).toEqual([]);
    expect(ls.getItem("pp.quickexit.tried")).toBe("1");
    expect(ls.getItem("pp.exit.dock.v")).toBe("2");
  });
  it("is wired into Quick Exit, both sign-out buttons, and any SIGNED_OUT event", () => {
    expect(readFileSync("src/lib/quick-exit.ts", "utf8")).toMatch(/clearHomeGuideStorage\(\)/);
    const bar = readFileSync("src/components/UtilityBar.tsx", "utf8");
    expect(
      bar.match(/clearHomeGuideStorage\(\);\s*void supabase\.auth\.signOut\(\)/g),
    ).toHaveLength(2);
    expect(readFileSync("src/components/AppShell.tsx", "utf8")).toMatch(
      /SIGNED_OUT"\) clearHomeGuideStorage\(\)/,
    );
  });
});

describe("(d) Quick Exit practice uses the real exit path", () => {
  it("the practice button calls quickExit, which signs out and replaces the page", () => {
    const card = readFileSync("src/components/survivor/HomeGuideCard.tsx", "utf8");
    expect(card).toMatch(/import \{ quickExit \} from "@\/lib\/quick-exit"/);
    expect(card).toMatch(/onClick=\{\(\) => quickExit\(settings\.exitUrl\)\}/);
    const qe = readFileSync("src/lib/quick-exit.ts", "utf8");
    expect(qe).toMatch(/supabase\.auth\.signOut\(\{ scope: "global" \}\)/);
    expect(qe).toMatch(/window\.location\.replace\(url\)/);
  });
});
