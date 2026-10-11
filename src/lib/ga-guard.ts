/**
 * Google Analytics kill switch for private routes.
 *
 * gtag.js honours `window['ga-disable-<MEASUREMENT_ID>'] = true`: while it is
 * set, no hit of any kind (manual page_view, enhanced-measurement page
 * changes, scroll, clicks, form interactions, user_engagement) is sent.
 *
 * Rules (Guardian ruling, real-data gate):
 *  - The flag is set on every page that is NOT on the public marketing/legal
 *    allowlist (public-routes.ts). Unknown pages fail closed.
 *  - It is set BEFORE the router renders a private page: an inline <head>
 *    script (GA_GUARD_INLINE_SCRIPT) evaluates the first URL and wraps
 *    history.pushState / replaceState and listens to popstate/hashchange
 *    before any app or gtag code runs, so it always runs before gtag's own
 *    history hooks.
 *  - Once a person is signed in, the flag stays set for the rest of the
 *    browser-tab session (sessionStorage), even on public pages.
 */
import { PUBLIC_MARKETING_PATHS, isPublicMarketingPath } from "@/lib/public-routes";

export const GA_MEASUREMENT_ID = "G-PXNVVNXEV5";
export const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;
/** sessionStorage key: "1" once someone has signed in during this tab session. */
export const GA_SESSION_OFF_KEY = "pp.ga.off";

type GaWindow = Window & Record<string, unknown>;

function win(): GaWindow | null {
  return typeof window === "undefined" ? null : (window as unknown as GaWindow);
}

function hasSupabaseSessionToken(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.includes("auth-token")) return true;
    }
  } catch {
    // storage unavailable: fall through
  }
  return false;
}

/** True when GA must stay off for the rest of this tab session. */
export function isGaOffForSession(): boolean {
  try {
    if (sessionStorage.getItem(GA_SESSION_OFF_KEY) === "1") return true;
  } catch {
    // ignore
  }
  return hasSupabaseSessionToken();
}

/** Call as soon as a signed-in user is known. Keeps GA disabled for the session. */
export function markGaSignedIn(): void {
  const w = win();
  if (!w) return;
  try {
    sessionStorage.setItem(GA_SESSION_OFF_KEY, "1");
  } catch {
    // ignore
  }
  w[GA_DISABLE_FLAG] = true;
}

/**
 * Set or clear the GA disable flag for a pathname / URL. Returns true when
 * analytics is allowed for that page.
 */
export function applyGaGuard(pathOrUrl: string): boolean {
  const w = win();
  if (!w) return false;
  let pathname = pathOrUrl;
  try {
    pathname = new URL(pathOrUrl, w.location.href).pathname;
  } catch {
    // keep as-is; isPublicMarketingPath strips query/hash itself
  }
  const allowed = !isGaOffForSession() && isPublicMarketingPath(pathname);
  w[GA_DISABLE_FLAG] = !allowed;
  return allowed;
}

export function isGaDisabled(): boolean {
  const w = win();
  return !w || w[GA_DISABLE_FLAG] === true;
}

/**
 * Inline script placed FIRST in <head>. Plain ES5, no imports. Mirrors
 * applyGaGuard()/isGaOffForSession() above (kept in lock-step by tests).
 */
export const GA_GUARD_INLINE_SCRIPT = `(function () {
  var FLAG = ${JSON.stringify(GA_DISABLE_FLAG)};
  var SESSION_KEY = ${JSON.stringify(GA_SESSION_OFF_KEY)};
  var PUBLIC = ${JSON.stringify(Object.fromEntries(PUBLIC_MARKETING_PATHS.map((p) => [p, 1])))};
  function pathOf(u) {
    var p = "";
    try { p = new URL(String(u), window.location.href).pathname; } catch (e) { p = ""; }
    if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p;
  }
  function offForSession() {
    try { if (window.sessionStorage.getItem(SESSION_KEY) === "1") return true; } catch (e) {}
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("auth-token") !== -1) return true;
      }
    } catch (e) {}
    return false;
  }
  function apply(u) {
    var allowed = !offForSession() && PUBLIC.hasOwnProperty(pathOf(u));
    window[FLAG] = !allowed;
    return allowed;
  }
  apply(window.location.href);
  var H = window.history;
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = H && H[m];
    if (typeof orig !== "function") return;
    H[m] = function (state, title, url) {
      apply(url === undefined || url === null ? window.location.href : url);
      return orig.apply(this, arguments);
    };
  });
  window.addEventListener("popstate", function () { apply(window.location.href); }, true);
  window.addEventListener("hashchange", function () { apply(window.location.href); }, true);
  window.__ppGaGuard = { apply: apply };
})();`;
