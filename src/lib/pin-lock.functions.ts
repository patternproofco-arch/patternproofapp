import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Server-verifiable app lock.
 *
 * Unlocking is proved to the SERVER, never by a flag the browser sets:
 *  - PIN: the hash lives server-side, comparisons are timing-safe, tries are limited;
 *  - biometrics: a real WebAuthn signature from a key enrolled on this account, checked
 *    against a one-time server challenge (see app-lock.server.ts and webauthn.server.ts).
 * Success returns a short-lived HMAC-signed token the client presents, and that this module
 * re-verifies, before the lock screen drops.
 *
 * Changing the lock while one exists (new PIN, remove PIN, enroll or remove biometrics)
 * needs a valid unlock token, so a signed-in session alone can't replace someone's lock.
 *
 * Not covered: a person who knows the PIN, or who can pass the device's own biometric check,
 * can unlock. The lock keeps a casual or curious person out of the app; it does not defeat
 * device monitoring or someone with full control of the device.
 */

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30 * 60 * 1000;

function tokenSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Server misconfigured: no signing secret available.");
  return s;
}

async function lockServer() {
  return import("@/lib/app-lock.server");
}

/** The site the browser is on, as the server sees it. The page can't pick this. */
async function rpContext() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const url = new URL(getRequest().url);
  return { origin: url.origin, rpId: url.hostname };
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const unlockProof = z.object({ unlockToken: z.string().max(500).optional() });

/** hasPin / biometric_enabled / app_lock_enabled, all server-recorded. */
export const getPinLockState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await (await lockServer()).lockState(await adminClient(), context.userId);
    return {
      app_lock_enabled: s.appLockEnabled,
      has_pin: s.hasPin,
      // Only a key enrolled on this account counts. The old database flag alone proves nothing.
      biometric_enabled: s.credentialCount > 0,
    };
  });

export const setPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    unlockProof.extend({ pin: z.string().regex(/^\d{4,8}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const lock = await lockServer();
    // Setting the first PIN is open. Replacing a lock that exists needs proof you unlocked it.
    await lock.requireUnlockProof(admin, context.userId, data.unlockToken, tokenSecret());
    const { hash, salt } = lock.hashPin(data.pin);
    const { error } = await admin.from("user_security_settings").upsert(
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
    return { ok: true as const, ...lock.issueToken(context.userId, tokenSecret()) };
  });

/** Everything the server needs to re-check who is asking, read from the auth service. */
async function reauthFor(userId: string) {
  const admin = await adminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) throw new Error("We couldn't check your account. Try again in a moment.");
  const email = user.email ?? "";
  const hasPassword = !!email && (user.identities ?? []).some((i) => i.provider === "email");
  return {
    hasPassword,
    lastSignInAt: user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : null,
    checkPassword: async (password: string) => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Server misconfigured.");
      const { createClient } = await import("@supabase/supabase-js");
      // A throwaway client: it checks the password and keeps nothing.
      const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
      const { error: e } = await c.auth.signInWithPassword({ email, password });
      return !e;
    },
  };
}

/** Forgot PIN: needs the account password again, so an open session alone can't replace the lock. */
export const resetPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ pin: z.string().regex(/^\d{4,8}$/), password: z.string().max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const lock = await lockServer();
    return lock.resetPin(await adminClient(), context.userId, {
      pin: data.pin,
      password: data.password,
      reauth: await reauthFor(context.userId),
      secret: tokenSecret(),
    });
  });

export const clearPinServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => unlockProof.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    await (await lockServer()).requireUnlockProof(admin, context.userId, data.unlockToken, tokenSecret());
    const { error } = await admin
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
    const supabaseAdmin = await adminClient();
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
      return { result: "real" as const, ...(await lockServer()).issueToken(context.userId, tokenSecret()) };
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

/* ------------------------- biometric (WebAuthn) ------------------------- */

export const beginBiometricEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => unlockProof.parse(input ?? {}))
  .handler(async ({ data, context }) =>
    (await lockServer()).beginEnroll(await adminClient(), context.userId, {
      token: data.unlockToken,
      rp: await rpContext(),
      secret: tokenSecret(),
    }),
  );

export const finishBiometricEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        clientDataJSON: z.string().min(1).max(4000),
        attestationObject: z.string().min(1).max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    (await lockServer()).finishEnroll(await adminClient(), context.userId, {
      response: data,
      rp: await rpContext(),
      secret: tokenSecret(),
    }),
  );

export const beginBiometricUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    (await lockServer()).beginUnlock(await adminClient(), context.userId, { rp: await rpContext() }),
  );

export const finishBiometricUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        credentialId: z.string().min(1).max(1400),
        clientDataJSON: z.string().min(1).max(4000),
        authenticatorData: z.string().min(1).max(4000),
        signature: z.string().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    (await lockServer()).finishUnlock(await adminClient(), context.userId, {
      response: data,
      rp: await rpContext(),
      secret: tokenSecret(),
    }),
  );

export const removeBiometricServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => unlockProof.parse(input ?? {}))
  .handler(async ({ data, context }) =>
    (await lockServer()).removeBiometric(await adminClient(), context.userId, {
      token: data.unlockToken,
      secret: tokenSecret(),
    }),
  );

export const checkUnlockToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    return { valid: (await lockServer()).verifyToken(data.token, context.userId, tokenSecret()) };
  });
