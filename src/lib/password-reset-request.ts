/**
 * Outcome of a /forgot-password request.
 *
 * Supabase Auth already answers success for addresses with no account, so there is
 * nothing to hide by swallowing errors: ANY error means the reset email was not sent.
 * Live 2026-10-15: an unmatched error fell through to "Check your email" and no email
 * arrived. Now only a result with no error shows the success screen; every error shows
 * a calm, retry-able message. Account existence is still never revealed.
 */
export const RESET_SEND_FAILED =
  "We couldn't send a reset link right now. Try again in a few minutes.";
export const RESET_RATE_LIMITED = "Too many attempts. Wait a minute and try again.";
export const RESET_NETWORK =
  "We couldn't reach the reset service. Check your connection and try again.";

export type ResetError = { message?: string; status?: number; code?: string } | null | undefined;

export type ResetOutcome =
  { kind: "sent" } | { kind: "error"; message: string; status: number | null; code: string | null };

export function classifyResetResult(error: ResetError): ResetOutcome {
  if (!error) return { kind: "sent" };
  const lower = (error.message ?? "").toLowerCase();
  const status = typeof error.status === "number" ? error.status : null;
  const code = typeof error.code === "string" && error.code ? error.code : null;
  let message = RESET_SEND_FAILED;
  if (
    status === 429 ||
    /rate limit|too many|over_request_rate|over_email_send_rate/.test(lower + " " + (code ?? ""))
  ) {
    message = RESET_RATE_LIMITED;
  } else if (/failed to fetch|network|timeout|load failed|fetch failed/.test(lower)) {
    message = RESET_NETWORK;
  }
  return { kind: "error", message, status, code };
}

/**
 * Diagnostics line for the browser console: HTTP status and Auth error code only.
 * Never the email address, the server's message text, or anything typed.
 */
export function resetDiagnostics(outcome: ResetOutcome): string | null {
  if (outcome.kind === "sent") return null;
  const code = outcome.code && /^[a-z0-9_]{1,64}$/i.test(outcome.code) ? outcome.code : "unknown";
  return `[password-reset] not sent: status=${outcome.status ?? "none"} code=${code}`;
}
