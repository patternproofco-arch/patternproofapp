/**
 * Server-side two-step sign-in gate (pure logic, no I/O).
 *
 * A session is "fully signed in" when either:
 *   - its JWT `aal` claim is "aal2" (the code was entered this session), or
 *   - the account has no verified authenticator factor (two-step is optional).
 *
 * An account WITH a verified factor whose session is still aal1 (password only)
 * is NOT fully signed in: no account data may load until the code is entered.
 * If the factor lookup fails we cannot tell, so we fail closed (step_up).
 */
export type FactorLookup = { ok: true; hasVerifiedFactor: boolean } | { ok: false };

export type AssuranceDecision = "allow" | "step_up";

export function readAal(claims: unknown): "aal1" | "aal2" | null {
  const aal = (claims as { aal?: unknown } | null | undefined)?.aal;
  return aal === "aal1" || aal === "aal2" ? aal : null;
}

export function decideAssurance(
  aal: "aal1" | "aal2" | null,
  lookup: FactorLookup,
): AssuranceDecision {
  if (aal === "aal2") return "allow";
  if (!lookup.ok) return "step_up";
  return lookup.hasVerifiedFactor ? "step_up" : "allow";
}

/** Error message thrown by server functions; the client gate sends people to /mfa. */
export const STEP_UP_REQUIRED = "Unauthorized: two-step sign-in code required";
