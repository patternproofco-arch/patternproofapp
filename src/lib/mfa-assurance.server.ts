/**
 * Server-side two-step sign-in check.
 *
 * Accounts with a verified authenticator factor must call record server
 * functions with an aal2 session (they finished the code step). Accounts
 * without one are unaffected. The database enforces the same rule with a
 * restrictive RLS policy (20261012200000_survivor_optional_mfa_aal2.sql).
 */
type FactorLister = {
  auth: {
    admin: {
      mfa: {
        listFactors: (params: { userId: string }) => Promise<{
          data: { factors?: Array<{ status: string }> } | null;
          error: unknown;
        }>;
      };
    };
  };
};

export const MFA_REQUIRED_MESSAGE = "Two-step sign-in required: enter your authenticator code.";

export async function assertAssuranceForEnrolledAccount(
  admin: FactorLister,
  userId: string,
  claims: { aal?: unknown },
): Promise<void> {
  if (claims.aal === "aal2") return;
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  // Fail closed: if we cannot tell whether a factor exists, do not return records.
  if (error || !data) throw new Error("Unauthorized: could not confirm sign-in step.");
  const verified = (data.factors ?? []).some((f) => f.status === "verified");
  if (verified) throw new Error(MFA_REQUIRED_MESSAGE);
}
