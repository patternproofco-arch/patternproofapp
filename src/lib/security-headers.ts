/**
 * Response headers every page and data response carries.
 *
 *  - nosniff: files are only treated as the type they say they are.
 *  - Referrer-Policy no-referrer: a link out (a hotline, a court site) never learns which page of
 *    PatternProof the person came from, and tokens that appear in invite paths are never sent along.
 *  - Permissions-Policy: the app asks for the microphone and camera itself, never for location, and
 *    embedded content gets none of them.
 *  - Pages are not stored by the browser or a shared cache (no-store): a signed-in page isn't
 *    left on disk for the next person to open from history. Static build files keep their own caching.
 *  - Framing: on the real site, nothing else can put PatternProof inside another page (clickjacking).
 *    Not applied on preview hosts, which are shown inside an editor frame.
 *
 * A full Content-Security-Policy is not set here: it needs testing against the payment, sign-in and
 * font providers on a staging site first.
 */

const PRODUCTION_HOSTS = new Set(["pattern-proof.tech", "www.pattern-proof.tech"]);

export function applySecurityHeaders(headers: Headers, url: URL): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "geolocation=(), camera=(self), microphone=(self)");

  const type = headers.get("content-type") ?? "";
  const isStatic = url.pathname.startsWith("/assets/") || /\.(?:js|css|woff2?|png|jpe?g|svg|ico|webp|webmanifest)$/i.test(url.pathname);
  const isPrep =
    url.pathname === "/prep" || url.pathname.startsWith("/prep/");
  // Spec v5: intake / study guide must not sit in browser or shared caches.
  if (isPrep) {
    headers.set("Cache-Control", "no-store, max-age=0");
  } else if (type.includes("text/html") && !isStatic && !headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }

  if (PRODUCTION_HOSTS.has(url.hostname)) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
}
