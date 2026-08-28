import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

/**
 * Server-verifiable app lock.
 *
 * Unlocking used to be a bare `sessionStorage` flag the client set after a
 * local hash comparison — anyone with a few seconds of devtools access to an
 * already-signed-in session could set that flag directly and skip PIN entry
 * entirely. Verification now happens here: the PIN hash lives server-side,
 * comparisons are timing-safe, and a successful check mints a short-lived
 * HMAC-signed token the client must present (and this module re-verifies)
 * before the lock screen is allowed to drop.
 *
 * Biometric unlock still runs its WebAuthn ceremony entirely client-side (a
 * real platform authenticator prompt, which can't be scripted from the page
 * the way a stored flag can) and then calls issueUnlockToken to mint the same
 * kind of proof. That endpoint does not itself re-verify a WebAuthn
 * assertion — full server-side WebAuthn verification is a larger follow-up —
 * so it is gated on the account having biometric enrollment on record, not on
 * cryptographic proof of this specific unlock. Documented as a known
 * residual gap, not claimed as fully closed.
 */

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30 * 60 * 1000;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function tokenSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Server misconfigured: no signing secret available.");
  return s;
}

function signToken(userId: string, expiresAt: number): string {
  const payload = `${userId}.${expiresAt}`;
  const mac = createHmac("sha256", tokenSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

function verifyToken(token: string, userId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, mac] = parts;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const dot = payload.indexOf(".");
  if (dot < 0) return false;
  const uid = payload.slice(0, dot);
  const expStr = payload.slice(dot + 1);
  const exp = Number(expStr);
  if (!uid || uid !== userId || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expectedMac = createHmac("sha256", tokenSecret()).update(payload).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expectedMac, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function issuedToken(userId: string) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return { token: signToken(userId, expiresAt), expiresAt };
}

/** hasPin / biometric_enabled / app_lock_enabled, all server-recorded. */
export const getPinLockState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_security_settings")
      .select("app_lock_enabled,biometric_enabled,pin_hash")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      app_lock_enabled: !!data?.app_lock_enabled,
      has_pin: !!data?.pin_hash,
      biometric_enabled: !!data?.biometric_enabled,
    };
  });

export const setPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pin: z.string().regex(/^\d{4,8}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(data.pin, salt, 64).toString("hex");
    const { error } = await supabaseAdmin.from("user_security_settings").upsert(
      {
        user_id: context.userId,
        pin_hash: hash,
        pin_salt: salt,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        app_lock_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, ...issuedToken(context.userId) };
  });

export const clearPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_security_settings")
      .update({
        pin_hash: null,
        pin_salt: null,
        pin_failed_attempts: 0,
        pin_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const verifyPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pin: z.string().min(1).max(16) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_security_settings")
      .select("pin_hash,pin_salt,pin_failed_attempts,pin_locked_until")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.pin_hash || !row.pin_salt) return { result: "no-pin" as const };
    if (row.pin_locked_until && new Date(row.pin_locked_until).getTime() > Date.now()) {
      return { result: "locked-out" as const };
    }
    const candidate = scryptSync(data.pin, row.pin_salt, 64);
    const real = Buffer.from(row.pin_hash, "hex");
    const matches = candidate.length === real.length && timingSafeEqual(candidate, real);
    if (matches) {
      await supabaseAdmin
        .from("user_security_settings")
        .update({ pin_failed_attempts: 0, pin_locked_until: null })
        .eq("user_id", context.userId);
      return { result: "real" as const, ...issuedToken(context.userId) };
    }
    const fails = (row.pin_failed_attempts ?? 0) + 1;
    const lockedUntil =
      fails >= PIN_MAX_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MS).toISOString() : null;
    await supabaseAdmin
      .from("user_security_settings")
      .update({ pin_failed_attempts: fails, pin_locked_until: lockedUntil })
      .eq("user_id", context.userId);
    return { result: lockedUntil ? ("locked-out" as const) : ("wrong" as const) };
  });

export const setBiometricEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_security_settings").upsert(
      {
        user_id: context.userId,
        biometric_enabled: data.enabled,
        app_lock_enabled: data.enabled ? true : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Mints an unlock token after a client-side WebAuthn ceremony succeeds. */
export const issueUnlockToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_security_settings")
      .select("biometric_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data?.biometric_enabled) throw new Error("Biometric unlock is not enrolled.");
    return { ok: true as const, ...issuedToken(context.userId) };
  });

export const checkUnlockToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    return { valid: verifyToken(data.token, context.userId) };
  });
