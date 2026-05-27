const allowedHostSuffix = () => {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
};

/**
 * Validate that a URL points at this project's Supabase storage host.
 * Prevents SSRF when fetching user-supplied signed URLs server-side.
 */
export function assertSupabaseStorageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:") throw new Error("URL must use https");
  const host = parsed.hostname.toLowerCase();
  const expected = allowedHostSuffix().toLowerCase();
  // Allow the project's Supabase host, or any *.supabase.co host (storage CDN variations).
  const ok = (expected && host === expected) || host.endsWith(".supabase.co");
  if (!ok) throw new Error("URL host not allowed");
}