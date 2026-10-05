/** Reject another account's object path, traversal and ambiguous encodings. */
export function assertOwnedStoragePath(path: string, ownerId: string): void {
  if (!ownerId || !path.startsWith(`${ownerId}/`))
    throw new Error("File is not owned by this account");
  if (
    /[%\\\u0000-\u001f]/.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid storage path");
  }
}

/** A signed URL is not permission to process another person's file. */
export function assertSupabaseStorageUrl(url: string, ownerId?: string): void {
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(process.env.SUPABASE_URL ?? "");
  } catch {
    throw new Error("Invalid storage URL or missing project configuration");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== expected.origin ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("URL host not allowed");
  }
  const prefix = "/storage/v1/object/sign/evidence-files/";
  if (!parsed.pathname.startsWith(prefix) || !parsed.searchParams.get("token")) {
    throw new Error("Signed evidence URL required");
  }
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    throw new Error("Invalid storage path");
  }
  // Even internally signed URLs must have an unambiguous path.
  assertOwnedStoragePath(path, ownerId ?? path.split("/")[0] ?? "");
}
