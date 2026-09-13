/** Client-only flag so a recovery link still lands on the set-password form
 * after Supabase consumes the tokens from the URL. */
export const RECOVERY_FLAG = "pp_password_recovery";

export function markPasswordRecovery(): void {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function consumePasswordRecovery(): boolean {
  try {
    const on = sessionStorage.getItem(RECOVERY_FLAG) === "1";
    if (on) sessionStorage.removeItem(RECOVERY_FLAG);
    return on;
  } catch {
    return false;
  }
}

export function peekPasswordRecovery(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Read recovery signals from the current URL before the client strips them. */
export function urlLooksLikeRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = search.get("type") ?? hash.get("type");
  const reason = search.get("reason") ?? hash.get("reason");
  return type === "recovery" || reason === "recovery";
}
