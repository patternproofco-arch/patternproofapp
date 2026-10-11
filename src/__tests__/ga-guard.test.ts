// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GA_DISABLE_FLAG,
  GA_GUARD_INLINE_SCRIPT,
  GA_SESSION_OFF_KEY,
  applyGaGuard,
  markGaSignedIn,
} from "@/lib/ga-guard";
import { ensureGtagLoaded, GTAG_SCRIPT_SRC } from "@/lib/ga";
import { GA_REPORTABLE_PATHS } from "@/lib/ga-routes";
import { readGeneratedRoutes } from "./helpers/route-tree";

type W = Window & Record<string, unknown>;
const w = window as unknown as W;

const realPush = window.history.pushState;
const realReplace = window.history.replaceState;

function runInlineGuard() {
  // Same as the browser executing the <head> inline script.
  new Function(GA_GUARD_INLINE_SCRIPT)();
}

function gtagScripts() {
  return document.querySelectorAll('script[src*="googletagmanager.com"]');
}

beforeEach(() => {
  window.history.pushState = realPush;
  window.history.replaceState = realReplace;
  realReplace.call(window.history, null, "", "/");
  sessionStorage.clear();
  localStorage.clear();
  Reflect.deleteProperty(w, GA_DISABLE_FLAG);
  Reflect.deleteProperty(w, "__ppGaLoaded");
  Reflect.deleteProperty(w, "gtag");
  Reflect.deleteProperty(w, "dataLayer");
  document.head.innerHTML = "";
});

afterEach(() => {
  window.history.pushState = realPush;
  window.history.replaceState = realReplace;
});

describe("GA kill switch (inline head guard)", () => {
  it("private first load: flag set and no gtag.js script on the page", () => {
    realReplace.call(window.history, null, "", "/dashboard?tab=entries");
    runInlineGuard();
    expect(w[GA_DISABLE_FLAG]).toBe(true);
    expect(ensureGtagLoaded(window.location.pathname)).toBe(false);
    expect(gtagScripts().length).toBe(0);
    expect(w.gtag).toBeUndefined();
  });

  it("public first load: flag clear", () => {
    realReplace.call(window.history, null, "", "/pricing?ref=abc");
    runInlineGuard();
    expect(w[GA_DISABLE_FLAG]).toBe(false);
  });

  it("sets the flag synchronously on pushState to a private route, before the router renders", () => {
    runInlineGuard();
    expect(w[GA_DISABLE_FLAG]).toBe(false);
    window.history.pushState({}, "", "/journal");
    expect(w[GA_DISABLE_FLAG]).toBe(true);
    window.history.pushState({}, "", "/how-it-works");
    expect(w[GA_DISABLE_FLAG]).toBe(false);
    window.history.replaceState({}, "", "/survivor-invite/tok_secret");
    expect(w[GA_DISABLE_FLAG]).toBe(true);
  });

  it("re-evaluates on back/forward (popstate)", () => {
    runInlineGuard();
    realPush.call(window.history, null, "", "/court-packet");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(w[GA_DISABLE_FLAG]).toBe(true);
  });

  it("once signed in, stays disabled for the session even on public pages", () => {
    runInlineGuard();
    markGaSignedIn();
    expect(sessionStorage.getItem(GA_SESSION_OFF_KEY)).toBe("1");
    window.history.pushState({}, "", "/");
    expect(w[GA_DISABLE_FLAG]).toBe(true);
    expect(applyGaGuard("/pricing")).toBe(false);
    expect(ensureGtagLoaded("/pricing")).toBe(false);
    expect(gtagScripts().length).toBe(0);
  });

  it("a stored Supabase session disables GA on a public first load", () => {
    localStorage.setItem("sb-muynotmkcmehxnkhffzl-auth-token", "{}");
    runInlineGuard();
    expect(w[GA_DISABLE_FLAG]).toBe(true);
    expect(applyGaGuard("/")).toBe(false);
  });

  it("inline guard and applyGaGuard agree on every route in routeTree.gen.ts", () => {
    runInlineGuard();
    const { fullPaths } = readGeneratedRoutes();
    const allow = new Set(GA_REPORTABLE_PATHS);
    for (const raw of fullPaths) {
      const concrete = raw.replace(/\$[A-Za-z]+/g, "x1");
      window.history.pushState({}, "", concrete);
      const inlineOff = w[GA_DISABLE_FLAG];
      const tsAllowed = applyGaGuard(concrete);
      const expectedAllowed = allow.has(raw.length > 1 ? raw.replace(/\/$/, "") : raw);
      expect({ raw, inlineOff, tsAllowed }).toEqual({
        raw,
        inlineOff: !expectedAllowed,
        tsAllowed: expectedAllowed,
      });
    }
  });
});

describe("lazy gtag.js loader", () => {
  it("injects gtag.js once on a public page, with no automatic page_view and no query string", () => {
    realReplace.call(window.history, null, "", "/?ref=secret-referral");
    expect(ensureGtagLoaded(window.location.pathname)).toBe(true);
    expect(ensureGtagLoaded(window.location.pathname)).toBe(true);
    const scripts = gtagScripts();
    expect(scripts.length).toBe(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(GTAG_SCRIPT_SRC);
    const config = (w.dataLayer as IArguments[])
      .map((a) => Array.from(a))
      .find((a) => a[0] === "config");
    expect(config).toBeTruthy();
    const opts = config![2] as Record<string, unknown>;
    expect(opts.send_page_view).toBe(false);
    expect(opts.allow_google_signals).toBe(false);
    expect(String(opts.page_location)).not.toContain("?");
    expect(String(opts.page_location)).not.toContain("secret-referral");
    expect(JSON.stringify(w.dataLayer)).not.toMatch(/user_id/);
  });

  it("never injects on any non-allowlisted route", () => {
    const { fullPaths } = readGeneratedRoutes();
    const allow = new Set(GA_REPORTABLE_PATHS);
    for (const raw of fullPaths.filter((p) => !allow.has(p))) {
      expect(ensureGtagLoaded(raw.replace(/\$[A-Za-z]+/g, "x1"))).toBe(false);
    }
    expect(gtagScripts().length).toBe(0);
  });
});
