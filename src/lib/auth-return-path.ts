/** Only local app paths may be carried through an authentication redirect. */
export function safeAuthReturnPath(
  value: string | null | undefined,
  origin: string,
): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === new URL(origin).origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/** Confirmation must finish server-side role setup before returning to the app. */
export function authConfirmationUrl(origin: string, returnPath?: string): string {
  const url = new URL("/auth/callback", origin);
  const safePath = safeAuthReturnPath(returnPath, origin);
  if (safePath) url.searchParams.set("redirect", safePath);
  return url.toString();
}
