/**
 * Which pages may be counted by analytics.
 *
 * Only the public site (home, pricing, how it works, the legal pages). Nothing a signed-in person
 * does, and nothing reached through a private invitation or review link, is reported, not even the
 * name of the page: that someone opened the court-packet or sharing screen is theirs to keep.
 */
const PRIVATE_PREFIXES = ["/_authenticated", "/_attorney", "/_advocate"];
const PRIVATE_FRAGMENTS = [
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
