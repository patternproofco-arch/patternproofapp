import { decideAssurance, readAal, STEP_UP_REQUIRED, type FactorLookup } from "./mfa-assurance";

type FactorLister = {
  auth: {
    admin: {
      mfa: {
        listFactors: (params: { userId: string }) => Promise<{
          data: { factors?: Array<{ status?: string }> } | null;
          error: unknown;
        }>;
      };
    };
  };
};

/**
 * Look up verified factors from Supabase Auth (service role, server only).
 * The JWT carries `aal` but not the factor list, so an aal1 token alone can't
 * tell "not enrolled" from "enrolled but code not entered yet".
 */
export async function lookupVerifiedFactor(
  admin: FactorLister,
  userId: string,
): Promise<FactorLookup> {
  try {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
    if (error || !data) return { ok: false };
    const factors = data.factors ?? [];
    return { ok: true, hasVerifiedFactor: factors.some((f) => f.status === "verified") };
  } catch {
    return { ok: false };
  }
}

export async function assertMfaAssurance(
  admin: FactorLister,
  userId: string,
  claims: unknown,
): Promise<void> {
  const aal = readAal(claims);
  // aal2 needs no lookup: the code was already entered this session.
  if (aal === "aal2") return;
  const lookup = await lookupVerifiedFactor(admin, userId);
  if (decideAssurance(aal, lookup) === "step_up") throw new Error(STEP_UP_REQUIRED);
}
