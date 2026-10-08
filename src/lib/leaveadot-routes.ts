/**
 * Leave a Dot may only load on public marketing pages.
 * Signed-in survivor, attorney, and advocate screens, plus invite and
 * shared-record links, sign-in/sign-up forms and the demo walkthrough, must
 * not load it (no session replay of entries, files, or form contents).
 *
 * Uses the same fail-closed allowlist as Google Analytics
 * (public-routes.ts) so the two third-party scripts can never drift apart.
 */
import { isPublicMarketingPath, stripToPathname } from "@/lib/public-routes";

export const LEAVE_A_DOT_SCRIPT_SRC = "https://app.leaveadot.com/dot.js";
export const LEAVE_A_DOT_PROJECT = "proj_ydd514h48rz0";
export const LEAVE_A_DOT_LINK = "ymjrs3q";

/** Normalize trailing slashes (and drop any query/hash) so "/pricing/" matches the allowlist. */
export function normalizePublicPath(pathname: string): string {
  return stripToPathname(pathname || "/");
}

export function shouldLoadLeaveADot(pathname: string): boolean {
  return isPublicMarketingPath(pathname);
}
