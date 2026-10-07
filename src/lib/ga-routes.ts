/**
 * Which pages may be counted by analytics.
 *
 * Only the public site (home, pricing, how it works, the legal pages). Nothing a signed-in person
 * does, and nothing reached through a private invitation or review link, is reported, not even the
 * name of the page: that someone opened the court-packet or sharing screen is theirs to keep.
 */
const PRIVATE_PREFIXES = ["/_authenticated", "/_attorney", "/_advocate"];
const PRIVATE_FRAGMENTS = [
  // Fictional /demo/* sub-portals (route ids "/demo_/attorney", "/demo_/org", "/demo_/prep").
  // Not reported at all, so nothing typed in a demo practice box can reach analytics.
  "/demo_",
  "invite",
  "$token",
  "/capture",
  "/intake",
  "/prep",
  "/mfa",
  "/reset-password",
  "/forgot-password",
  "/review",
  "/org-portal",
  "/connect",
  "/auth",
];

export function isReportableRoute(routeId: string): boolean {
  if (PRIVATE_PREFIXES.some((p) => routeId.startsWith(p))) return false;
  if (PRIVATE_FRAGMENTS.some((f) => routeId.includes(f))) return false;
  return true;
}
