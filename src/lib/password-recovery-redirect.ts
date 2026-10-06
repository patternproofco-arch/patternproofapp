/**
 * Canonical redirect target for Supabase Auth password recovery emails.
 *
 * Production hosts (pattern-proof.tech / www) always use the apex https origin
 * so the link matches the muy Auth redirect allow-list even when the survivor
 * opened the site on www or http. Preview / staging origins are preserved so
 * Lovable preview can still complete the flow when those URLs are allow-listed.
 */

export const CANONICAL_PRODUCTION_ORIGIN = "https://pattern-proof.tech";

/** Path + query appended to the chosen origin. */
export const PASSWORD_RECOVERY_PATH = "/reset-password?reason=recovery";

const PRODUCTION_HOSTS = new Set(["pattern-proof.tech", "www.pattern-proof.tech"]);

/**
 * Build the redirectTo passed to resetPasswordForEmail.
 * @param pageOrigin Optional origin (e.g. window.location.origin or getEmailSiteOrigin()).
 */
export function passwordRecoveryRedirectTo(pageOrigin?: string | null): string {
  const raw =
    (typeof pageOrigin === "string" && pageOrigin.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : CANONICAL_PRODUCTION_ORIGIN);

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (PRODUCTION_HOSTS.has(host)) {
      return `${CANONICAL_PRODUCTION_ORIGIN}${PASSWORD_RECOVERY_PATH}`;
    }
    return `${url.origin}${PASSWORD_RECOVERY_PATH}`;
  } catch {
    return `${CANONICAL_PRODUCTION_ORIGIN}${PASSWORD_RECOVERY_PATH}`;
  }
}
