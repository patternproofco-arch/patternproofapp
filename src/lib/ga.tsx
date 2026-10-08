import { useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { isReportablePath, isReportableRoute, stripToPathname } from "@/lib/ga-routes";
import {
  GA_DISABLE_FLAG,
  GA_MEASUREMENT_ID,
  applyGaGuard,
  isGaOffForSession,
  markGaSignedIn,
} from "@/lib/ga-guard";

export { GA_MEASUREMENT_ID };

export const GTAG_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    __ppGaLoaded?: boolean;
  }
}

/** origin + pathname only. Never a query string or hash. */
function cleanLocation(pathname: string): string {
  return `${window.location.origin}${stripToPathname(pathname)}`;
}

/** Referrer reduced to its origin (no path, no query) so nothing private leaks via it. */
function cleanReferrer(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

/**
 * Inject gtag.js and the config call — ONLY when the current page is an
 * allowlisted public page and nobody has signed in this session. Nothing is
 * injected at all on a private first load (no script tag in the SSR head).
 */
export function ensureGtagLoaded(pathname: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (window.__ppGaLoaded) return true;
  if (isGaOffForSession() || !isReportablePath(pathname)) return false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js requires the Arguments object itself, not an array copy.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: cleanLocation(pathname),
    page_referrer: cleanReferrer(),
  });

  const s = document.createElement("script");
  s.async = true;
  s.src = GTAG_SCRIPT_SRC;
  document.head.appendChild(s);
  window.__ppGaLoaded = true;
  return true;
}

/**
 * Sends a virtual pageview to GA4 on route changes — public marketing/legal
 * pages only (allowlist, fail closed; see ga-routes.ts). Reports the matched
 * route *pattern*; the query string is never sent (referral codes live
 * there) and no user id or form value is ever sent. GA4's own automatic
 * page_view is disabled (send_page_view: false).
 *
 * On every navigation to a non-allowlisted route the GA disable flag is set
 * before the new page renders (inline head guard + onBeforeNavigate), and once
 * someone is signed in it stays set for the session.
 */
export function GoogleAnalyticsRouteTracker() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const selected = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId ?? "/",
  });
  const routeId = typeof selected === "string" ? selected : "/";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Signed in → GA off for the rest of this tab session.
  useEffect(() => {
    if (user) markGaSignedIn();
  }, [user]);

  // Flip the kill switch before the next route renders.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = router.subscribe("onBeforeNavigate", (e) => {
      applyGaGuard(e.toLocation.pathname);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const allowed =
      !user && isReportableRoute(routeId) && isReportablePath(pathname) && applyGaGuard(pathname);
    if (!allowed) {
      (window as unknown as Record<string, unknown>)[GA_DISABLE_FLAG] = true;
      return;
    }
    // Wait for the auth check so a signed-in person landing on a public page
    // never triggers a load before we know they are signed in.
    if (loading) return;
    if (!ensureGtagLoaded(pathname) || typeof window.gtag !== "function") return;
    const location = cleanLocation(routeId);
    window.gtag("set", { page_location: location, page_referrer: cleanReferrer() });
    window.gtag("event", "page_view", {
      page_path: stripToPathname(routeId),
      page_location: location,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [routeId, pathname, user, loading]);

  return null;
}
