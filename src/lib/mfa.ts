import { supabase } from "@/integrations/supabase/client";
/** True when the person has a verified authenticator but this session is still AAL1. */
export async function sessionNeedsMfa(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}

export async function verifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  const verified = data.totp.find((f) => f.status === "verified");
  return verified?.id ?? null;
}

export async function hasVerifiedTotp(): Promise<boolean> {
  return (await verifiedTotpFactorId()) !== null;
}

export type MfaGateDecision = "allow" | "challenge" | "enroll" | "deny";

/**
 * Decides what a protected route may show. When `requireEnrollment` is true
 * (attorney and collaborator case files), an indeterminate result — a failed
 * assurance-level lookup or a failed factor lookup — resolves to "deny" so the
 * portal is never rendered on an unknown MFA state.
 */
export async function resolveMfaGate(options: {
  requireEnrollment?: boolean;
}): Promise<MfaGateDecision> {
  const required = options.requireEnrollment === true;
  const onError: MfaGateDecision = required ? "deny" : "allow";
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return onError;
    if (data.currentLevel === "aal1" && data.nextLevel === "aal2") return "challenge";

    if (required) {
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError || !factors) return "deny";
      const verified = (factors.totp ?? []).some((f) => f.status === "verified");
      if (!verified) return "enroll";
    }
    return "allow";
  } catch {
    return onError;
  }
}


/**
 * Attorney routes that must stay reachable at AAL1 so someone can pay,
 * finish setup, and enroll an authenticator. Everything else in the
 * attorney portal requires a verified TOTP factor + AAL2.
 */
export function attorneyPathExemptFromRequiredMfa(pathname: string): boolean {
  return (
    pathname === "/subscribe" ||
    pathname === "/billing-return" ||
    pathname === "/setup" ||
    pathname === "/billing" ||
    pathname === "/trust" ||
    pathname === "/two-factor"
  );
}

/** Unverified enrollments pile up if someone starts setup and leaves. */
export async function dropUnverifiedTotpFactors(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  const pending = (data?.totp ?? []).filter(
    (f) => (f as { status?: string }).status === "unverified",
  );
  await Promise.all(pending.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
}
