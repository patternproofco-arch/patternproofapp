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

/** Unverified enrollments pile up if someone starts setup and leaves. */
export async function dropUnverifiedTotpFactors(): Promise<void> {
  const { data } = await supabase.auth.mfa.listFactors();
  const pending = (data?.totp ?? []).filter((f) => f.status === "unverified");
  await Promise.all(pending.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
}
