import { supabase } from "@/integrations/supabase/client";
import { isTestAccountEmail } from "@/lib/test-accounts";

async function currentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

/** True when the person has a verified authenticator but this session is still AAL1. */
export async function sessionNeedsMfa(): Promise<boolean> {
  if (isTestAccountEmail(await currentEmail())) return false;
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
  if (isTestAccountEmail(await currentEmail())) return true;
  return (await verifiedTotpFactorId()) !== null;
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
  // `data.totp` is typed (and behaves) as verified-only — `data.all` is the
  // one that actually includes unverified factors of every type.
  const pending = (data?.all ?? []).filter(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  );
  await Promise.all(pending.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
}
