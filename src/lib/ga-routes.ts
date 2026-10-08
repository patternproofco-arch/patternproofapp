/**
 * Which pages may be counted by analytics.
 *
 * ALLOWLIST (fail closed): only the public marketing and legal pages listed
 * in public-routes.ts. Nothing a signed-in person does, and nothing reached
 * through a private invitation, review, prep, org, demo, or recovery link, is
 * reported — not even the name of the page. Any route that is not on the
 * allowlist, including routes added in the future, is non-reportable.
 */
import { isPublicMarketingPath, stripToPathname } from "@/lib/public-routes";

export { PUBLIC_MARKETING_PATHS as GA_REPORTABLE_PATHS } from "@/lib/public-routes";

/** Route id (e.g. "/pricing", "/_authenticated/journal") → reportable? */
export function isReportableRoute(routeId: string): boolean {
  if (typeof routeId !== "string" || routeId.length === 0) return false;
  // Route ids never carry a query string; refuse anything that looks odd
  // rather than normalising it into a match.
  if (/[?#]/.test(routeId)) return false;
  return isPublicMarketingPath(routeId);
}

/** Browser pathname (may include a query string) → reportable? */
export function isReportablePath(pathname: string): boolean {
  return isPublicMarketingPath(pathname);
}

export { stripToPathname };
