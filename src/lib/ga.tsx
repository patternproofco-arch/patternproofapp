import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

export const GA_MEASUREMENT_ID = "G-PXNVVNXEV5";

/**
 * Analytics is restricted to PUBLIC MARKETING PAGES ONLY.
 *
 * Nothing inside the survivor app, the attorney portal, the advocate/org
 * portal, invite/token routes or the demo may reach Google Analytics — no
 * URLs, no query strings, no page titles, no record identifiers. The list
 * below is an explicit allowlist of exact public paths; anything not on it is
 * never tracked, and no search string or document title is ever transmitted.
 */
const PUBLIC_ANALYTICS_PATHS = new Set<string>([
  "/",
  "/pricing",
  "/for-attorneys",
  "/for-organizations",
  "/how-it-works",
  "/attorneys",
  "/lawyer-signup",
  "/professional-access",
  "/request-org-access",
  "/waitlist",
  "/resources",
  "/safety",
  "/support",
  "/self-help-guide",
  "/evidence-integrity",
  "/ai-transparency",
  "/privacy",
  "/terms",
  "/sample-case",
]);

/** True only for public marketing pages that carry no survivor context. */
export function isPublicAnalyticsPath(pathname: string): boolean {
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return PUBLIC_ANALYTICS_PATHS.has(clean);
}

function currentPathIsPublic(): boolean {
  if (typeof window === "undefined") return false;
  return isPublicAnalyticsPath(window.location.pathname);
}

/**
 * Fires a GA4 event. No-ops on the server, before gtag.js has loaded, and on
 * every non-public route. Params are passed through as given — never pass
 * survivor content, identifiers, or URLs.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!currentPathIsPublic()) return;
  window.gtag("event", name, { ...params, send_to: GA_MEASUREMENT_ID });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Sends a pageview for public marketing pages only. Automatic pageviews are
 * disabled in the root gtag config (`send_page_view: false`) so this is the
 * single place a page_view can originate. Only the bare pathname is sent —
 * never the query string, never the document title, never the full URL.
 */
export function GoogleAnalyticsRouteTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    if (!isPublicAnalyticsPath(pathname)) return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: undefined,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [pathname]);

  return null;
}
