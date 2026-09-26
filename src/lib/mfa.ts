import { supabase } from "@/integrations/supabase/client";

/**
 * There are no account-level exemptions here. Every signed-in account,
 * including internal QA accounts, goes through the same checks.
 */

/**
 * IMPORTANT: supabase.auth.mfa.listFactors() does NOT call the network.
 * It reads factors from the cached user object. Blocking "factors" URLs in a
 * browser harness therefore never fails that helper — it still returns empty
 * totp and looks like "unenrolled" / enroll.
 *
 * For fail-closed MFA we MUST probe GET /auth/v1/factors over the network.
 * If that request errors, times out, or is non-OK → treat as unknown/deny.
 */

type FactorProbe =
  | { ok: true; totp: Array<{ id: string; status: string }> }
  | { ok: false };

async function probeFactorsOverNetwork(): Promise<FactorProbe> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) return { ok: false };

    const baseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!baseUrl || !anonKey) return { ok: false };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/auth/v1/factors`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: anonKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!res.ok) return { ok: false };
      const body = (await res.json()) as
        | { totp?: Array<{ id: string; status: string }> }
        | Array<{ id: string; status: string; factor_type?: string }>;

      // GoTrue may return { totp, phone, ... } or a flat factor array.
      if (Array.isArray(body)) {
        const totp = body.filter(
          (f) => !f.factor_type || f.factor_type === "totp",
        ) as Array<{ id: string; status: string }>;
        return { ok: true, totp };
      }
      return { ok: true, totp: body.totp ?? [] };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { ok: false };
  }
}

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
  const probe = await probeFactorsOverNetwork();
  if (!probe.ok) return "unknown";
  const verified = probe.totp.some((f) => f.status === "verified");
  return verified ? "verified" : "unenrolled";
}

export async function verifiedTotpFactorId(): Promise<string | null> {
  const probe = await probeFactorsOverNetwork();
  if (!probe.ok) return null;
  return probe.totp.find((f) => f.status === "verified")?.id ?? null;
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
      // Network probe — not supabase.auth.mfa.listFactors() (cached / no HTTP).
      const probe = await probeFactorsOverNetwork();
      if (!probe.ok) return "deny";
      const verified = probe.totp.some((f) => f.status === "verified");
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
  // Unenroll still uses the SDK; enrollment cleanup is best-effort.
  const { data } = await supabase.auth.mfa.listFactors();
  const pending = (data?.totp ?? []).filter((f) => String(f.status) !== "verified");
  await Promise.all(pending.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
}
