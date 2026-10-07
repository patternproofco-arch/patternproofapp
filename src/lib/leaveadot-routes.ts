/**
 * Leave a Dot may only load on public marketing pages.
 * Signed-in survivor, attorney, and advocate screens, plus invite and
 * shared-record links, must not load it (no session replay of entries,
 * files, or form contents).
 */
const LEAVE_A_DOT_PUBLIC_PATHS = new Set([
  "/",
  "/how-it-works",
  "/for-attorneys",
  "/for-organizations",
  "/pricing",
  "/safety",
  "/privacy",
  "/terms",
  "/signup",
  "/signin",
  "/login",
  "/demo",
  "/family-law-workload",
  "/resources",
  "/support",
  "/ai-transparency",
  "/evidence-integrity",
  "/attorneys",
  "/partner-access",
  "/professional-access",
  "/self-help-guide",
  "/sample-case",
  "/lawyer-signup",
  "/org-signup",
  "/org-feedback",
  "/choose-role",
  "/triage",
  "/version",
  "/unsubscribe",
]);

export const LEAVE_A_DOT_SCRIPT_SRC = "https://app.leaveadot.com/dot.js";
export const LEAVE_A_DOT_PROJECT = "proj_ydd514h48rz0";
export const LEAVE_A_DOT_LINK = "ymjrs3q";

/** Normalize trailing slashes so "/pricing/" matches the allowlist. */
export function normalizePublicPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}

export function shouldLoadLeaveADot(pathname: string): boolean {
  const path = normalizePublicPath(pathname);
  // Fictional /demo/* sub-portals (attorney, org, court-prep practice) never load session
  // replay, even if someone later adds them to the list above.
  if (path.startsWith("/demo/")) return false;
  return LEAVE_A_DOT_PUBLIC_PATHS.has(path);
}
