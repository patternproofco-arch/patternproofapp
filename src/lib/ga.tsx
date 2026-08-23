import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

export const GA_MEASUREMENT_ID = "G-PXNVVNXEV5";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Sends a virtual pageview to GA4 on every route change, including the
 * first. Reports the matched route's *pattern* (e.g.
 * "/survivor-invite/$token"), never the resolved pathname — so dynamic
 * segments (invite tokens, ids) are a literal placeholder string by
 * construction and never reach GA, and the query string is never sent at
 * all (referral codes live there). GA4's own auto-pageview is disabled
 * (send_page_view: false in the root config call) so this is the only
 * path a pageview reaches GA through.
 */
export function GoogleAnalyticsRouteTracker() {
  const routeId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId ?? "/",
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: routeId,
      page_location: `${window.location.origin}${routeId}`,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [routeId]);

  return null;
}
