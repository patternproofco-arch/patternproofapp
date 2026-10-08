/**
 * Leave a Dot may only load on public marketing pages.
 * Pages where someone types a password, an email, a contact message or an answer about their
 * situation (sign-in, sign-up, support, partner and feedback forms, the safety triage) are
 * deliberately NOT on this list. A third-party script on those pages could see what is typed.
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
  "/demo",
  "/family-law-workload",
  "/resources",
  "/ai-transparency",
  "/evidence-integrity",
  "/attorneys",
  "/professional-access",
  "/self-help-guide",
  "/sample-case",
  "/version",
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
  return LEAVE_A_DOT_PUBLIC_PATHS.has(normalizePublicPath(pathname));
}
