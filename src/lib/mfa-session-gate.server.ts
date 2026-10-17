/**
 * Server-side MFA assurance gate.
 *
 * The UI challenges a person whose account has a verified TOTP factor, but the
 * UI is not a security boundary. Every server function behind
 * requireSupabaseAuth (which includes the attorney, advocate and org portal
 * gates) runs this check: if the account has a verified TOTP factor, the
 * session JWT must carry aal = "aal2". Lookup failures fail closed.
 * Accounts without a verified factor are unaffected.
 */
export const MFA_REQUIRED_MESSAGE = "Please sign in again to continue.";

type Claims = { aal?: unknown } & Record<string, unknown>;

export async function assertSessionMeetsMfa(
  admin: any,
  userId: string,
  claims: Claims | null | undefined,
): Promise<void> {
  // An aal2 session satisfies any enrolled factor; no lookup needed.
  if (claims?.aal === "aal2") return;

  let factors: Array<{ status?: string; factor_type?: string }> | undefined;
  try {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
    if (error || !data) throw new Error("lookup failed");
    factors = data.factors;
  } catch {
    throw new Error(MFA_REQUIRED_MESSAGE);
  }
  if (!Array.isArray(factors)) throw new Error(MFA_REQUIRED_MESSAGE);

  const hasVerifiedTotp = factors.some(
    (f) => f?.status === "verified" && (!f.factor_type || f.factor_type === "totp"),
  );
  if (hasVerifiedTotp) throw new Error(MFA_REQUIRED_MESSAGE);
}
