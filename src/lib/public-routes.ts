/**
 * The public marketing and legal pages. This is the ONLY set of pages on
 * which third-party scripts (Google Analytics, Leave a Dot) may load or
 * report.
 *
 * This is an allowlist on purpose: a page that is not listed here is treated
 * as private, so a new screen added later fails closed (no tracking) until
 * someone deliberately adds it. Never add a signed-in screen, an invite or
 * review link, a form that collects personal details, sign-in/sign-up, or the
 * demo walkthrough.
 *
 * Entries are both the browser pathname and the TanStack route id for these
 * pages (they are all top-level, static routes with no dynamic segments).
 */
export const PUBLIC_MARKETING_PATHS: readonly string[] = Object.freeze([
  "/",
  "/how-it-works",
  "/for-attorneys",
  "/for-organizations",
  "/pricing",
  "/family-law-workload",
  "/resources",
  "/self-help-guide",
  "/evidence-integrity",
  "/ai-transparency",
  "/professional-access",
  "/founding-testers",
  "/safety",
  "/privacy",
  "/terms",
]);

const PUBLIC_SET = new Set(PUBLIC_MARKETING_PATHS);

/**
 * Pathname only: drops any query string or hash, and a trailing slash, so
 * "/pricing/?ref=abc#x" becomes "/pricing". Never returns the query string.
 */
export function stripToPathname(pathOrUrl: string): string {
  let p = typeof pathOrUrl === "string" ? pathOrUrl : "";
  const cut = p.search(/[?#]/);
  if (cut !== -1) p = p.slice(0, cut);
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/** True only for an allowlisted public marketing / legal page. Unknown → false. */
export function isPublicMarketingPath(pathOrUrl: string): boolean {
  return PUBLIC_SET.has(stripToPathname(pathOrUrl));
}
