/**
 * Canonical public origin for transactional email CTAs (invite accept links, etc.).
 *
 * Prefer SITE_URL (Lovable / host convention), then PUBLIC_SITE_URL.
 * Never emit localhost / loopback in email bodies — production deploys have
 * been observed with SITE_URL or request.origin set to http://localhost:8080,
 * which produced broken survivor-invite CTAs in live mailboxes.
 */

export const CANONICAL_PRODUCTION_SITE_ORIGIN = "https://pattern-proof.tech";

function isLoopbackOrLocalhost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

/** Normalize a candidate URL to an origin, or null if unusable for email CTAs. */
export function normalizeEmailSiteOrigin(raw: string | undefined | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (isLoopbackOrLocalhost(url.hostname)) return null;
    // Public production hosts must be https in email CTAs.
    const prodHosts = new Set([
      "pattern-proof.tech",
      "www.pattern-proof.tech",
      "attorney.pattern-proof.tech",
    ]);
    if (prodHosts.has(url.hostname.toLowerCase()) && url.protocol === "http:") {
      return `https://${url.host}`;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origin used when building invite / transactional email links.
 * Never returns localhost. Safe production fallback: https://pattern-proof.tech.
 */
export function getEmailSiteOrigin(): string {
  const candidates = [process.env.SITE_URL, process.env.PUBLIC_SITE_URL];
  for (const raw of candidates) {
    const origin = normalizeEmailSiteOrigin(raw);
    if (origin) return origin;
  }
  return CANONICAL_PRODUCTION_SITE_ORIGIN;
}
