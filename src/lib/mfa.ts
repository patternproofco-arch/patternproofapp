import { supabase } from "@/integrations/supabase/client";

/**
 * There are no account-level exemptions here. Every signed-in account,
 * including internal QA accounts, goes through the same checks.
 */

/** True when the person has a verified authenticator but this session is still AAL1. */
export async function sessionNeedsMfa(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}

export type TotpStatus = "verified" | "unenrolled" | "unknown";

/**
 * Distinguish "no authenticator" from "we could not look up factors".
 * Callers that require MFA must treat "unknown" as fail-closed (deny / sign-in),
 * never as enroll.
 */
export async function totpStatus(): Promise<TotpStatus> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return "unknown";
    const verified = (data.totp ?? []).some((f) => f.status === "verified");
    return verified ? "verified" : "unenrolled";
  } catch {
    return "unknown";
  }
}

export async function verifiedTotpFactorId(): Promise<string | null> {
  const status = await totpStatus();
  if (status !== "verified") return null;
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp.find((f) => f.status === "verified");
  return verified?.id ?? null;
}

export async function hasVerifiedTotp(): Promise<boolean> {
  return (await totpStatus()) === "verified";
}

export type MfaGateDecision = "allow" | "challenge" | "enroll" | "deny";

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
      // listFactors must succeed. Network/API failure → deny, never enroll.
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

/** Paths where attorney portal chrome (sidebar/caseload nav) must not appear. */
export function attorneyPathWithoutPortalChrome(pathname: string): boolean {
  return pathname === "/trust" || pathname === "/two-factor";
}

export async function dropUnverifiedTotpFactors(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  const pending = (data?.totp ?? []).filter((f) => String(f.status) !== "verified");
  await Promise.all(pending.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
}
