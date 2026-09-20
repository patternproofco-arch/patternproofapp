/**
 * Map Supabase / network auth failures to short, visible survivor-facing copy.
 * Soft claims only — no absolute privacy promises.
 */

export type AuthMode = "login" | "signup";

function rawMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (typeof err === "string" && err.trim()) return err;
  return "";
}

/** Pure helper — unit-tested. Prefer this over raw API strings in the UI. */
export function formatAuthError(err: unknown, mode: AuthMode): string {
  const raw = rawMessage(err).trim();
  const lower = raw.toLowerCase();

  if (
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|econnrefused|enotfound/i.test(
      lower,
    ) ||
    lower === "network error"
  ) {
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  }

  if (/invalid login credentials|invalid email or password|invalid credentials/i.test(lower)) {
    return "That email or password doesn't match. Check both and try again.";
  }

  if (/email not confirmed|confirm.*(email|signup)|not confirmed/i.test(lower)) {
    return "Confirm your email first — check your inbox for the link, then sign in.";
  }

  if (/user already registered|already been registered|already registered/i.test(lower)) {
    // Never confirm or deny that an email already has an account on signup —
    // that's an enumeration channel a stalker could use to check whether a
    // specific person has signed up. The reply reads the same either way.
    return mode === "signup"
      ? "Check your email to continue. If this address is new, confirm it to finish creating your account. If it's already registered, sign in instead."
      : "That email already has an account. Try signing in instead.";
  }

  if (/password.*(at least|too short|least 6|least 8)|weak password/i.test(lower)) {
    return "Use a password with at least 8 characters.";
  }

  if (/rate limit|too many requests|over_request_rate|email rate/i.test(lower)) {
    return "Too many attempts. Wait a minute and try again.";
  }

  if (/user not found|no user found|unable to find user/i.test(lower)) {
    return "We couldn't find an account with that email. Check the spelling or create an account.";
  }

  if (/signup.?disabled|signups? not allowed/i.test(lower)) {
    return "New accounts aren't open right now. Try again later or contact support.";
  }

  if (raw) {
    return mode === "login"
      ? `We couldn't sign you in. ${raw}`
      : `We couldn't create your account. ${raw}`;
  }

  return mode === "login"
    ? "We couldn't sign you in. Try again in a moment."
    : "We couldn't create your account. Try again in a moment.";
}

/**
 * After signUp with no session: either email confirmation is required, or
 * Supabase hid a duplicate-email case (empty identities). Deliberately
 * returns the same copy either way — distinguishing the two would let
 * anyone check whether a specific email already has an account, which is
 * exactly the enumeration channel this app can't expose.
 */
export function formatSignupNoSession(
  user: {
    identities?: { id?: string }[] | null;
  } | null,
): string {
  void user;
  return "Check your email to continue. If this address is new, confirm it to finish creating your account. If it's already registered, sign in instead.";
}
