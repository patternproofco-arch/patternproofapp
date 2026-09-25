const ALLOWED_HOSTS = new Set([
  "pattern-proof.tech",
  "www.pattern-proof.tech",
  "pattern-proofapp.lovable.app",
  "localhost",
]);

/** Only allow Stripe return URLs that point back to this app. */
export function assertSafeReturnUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid return URL");
  }
  const host = parsed.hostname.toLowerCase();
  const ok =
    ALLOWED_HOSTS.has(host) ||
    (host.endsWith(".lovable.app") && host.includes("f496a23a-1a8f-408f-b5e0-e96d5947d49c")) ||
    host.endsWith(".lovableproject.com");
  if (!ok) throw new Error("Return URL not allowed");
  if (parsed.protocol !== "https:" && host !== "localhost") throw new Error("Return URL must use https");
  return parsed.toString();
}
