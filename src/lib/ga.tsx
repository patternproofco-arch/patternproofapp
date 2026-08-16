import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

export const GA_MEASUREMENT_ID = "G-PXNVVNXEV5";

/**
 * Fires a GA4 event. Safe on the server and before gtag.js has loaded —
 * same guard pattern used by the route tracker below.
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...params, send_to: GA_MEASUREMENT_ID });
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Sends a virtual pageview to GA4 on every client-side route change.
 * The initial pageview is sent by the gtag `config` call in the root head.
 */
export function GoogleAnalyticsRouteTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const isFirst = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.gtag("event", "page_view", {
      page_path: `${pathname}${search ?? ""}`,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [pathname, search]);

  return null;
}
