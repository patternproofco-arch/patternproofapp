/**
 * Client-visible Supabase config (URL + publishable key only).
 * Fail closed when missing/empty — never invent a host fallback.
 */

export type ClientSupabaseConfig = {
  url: string;
  publishableKey: string;
};

/** Pure: trim and require both URL and publishable key. */
export function normalizeClientSupabaseConfig(
  url: unknown,
  publishableKey: unknown,
): ClientSupabaseConfig | null {
  const trimmedUrl = typeof url === "string" ? url.trim() : "";
  const trimmedKey = typeof publishableKey === "string" ? publishableKey.trim() : "";
  if (!trimmedUrl || !trimmedKey) return null;
  return { url: trimmedUrl, publishableKey: trimmedKey };
}

/**
 * Read bake-time / runtime client env. Empty strings and whitespace fail closed.
 * Prefers VITE_* (browser) then non-VITE names for SSR.
 */
export function readClientSupabaseConfig(): ClientSupabaseConfig | null {
  const serverEnv = typeof process !== "undefined" ? process.env : undefined;
  const url = import.meta.env.VITE_SUPABASE_URL || serverEnv?.SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || serverEnv?.SUPABASE_PUBLISHABLE_KEY;
  return normalizeClientSupabaseConfig(url, publishableKey);
}

export function isClientSupabaseConfigured(): boolean {
  return readClientSupabaseConfig() !== null;
}
