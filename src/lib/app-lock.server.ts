/**
 * App lock: unlock tokens and the server-verified biometric ceremony.
 *
 * Rules:
 *  - a biometric unlock needs a real WebAuthn signature from a key enrolled on this account;
 *    there is no endpoint that issues an unlock token without proof;
 *  - while any lock exists (a PIN or an enrolled device), changing it (new PIN, remove PIN,
 *    enroll another device, remove biometrics) needs a valid unlock token from this session,
 *    so someone holding only a signed-in session can't swap the lock for their own;
 *  - challenges are server-issued, single-use and short-lived; a failed attempt uses one up;
 *  - tries are rate-limited per account.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebAuthnError,
  b64urlDecode,
  b64urlEncode,
  verifyAssertion,
  verifyRegistration,
  type Jwk,
} from "@/lib/webauthn.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_UNLOCK_CHALLENGES_PER_WINDOW = 10;
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

export const LOCKED_MESSAGE = "Unlock the app first to change your lock.";

// ---------------------------------------------------------------------------
// Unlock tokens
// ---------------------------------------------------------------------------

export function signToken(userId: string, expiresAt: number, secret: string): string {
  const payload = `${userId}.${expiresAt}`;
  const mac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

export function verifyToken(token: string | undefined | null, userId: string, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, mac] = parts as [string, string];
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const dot = payload.indexOf(".");
  if (dot < 0) return false;
  const uid = payload.slice(0, dot);
  const exp = Number(payload.slice(dot + 1));
  if (!uid || uid !== userId || !Number.isFinite(exp) || exp < now) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  // Buffer.from(…, "hex") quietly ignores trailing junk, so insist on exactly a SHA-256 hex digest.
  if (!/^[0-9a-f]{64}$/.test(mac)) return false;
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function issueToken(userId: string, secret: string, now = Date.now()) {
  const expiresAt = now + TOKEN_TTL_MS;
  return { token: signToken(userId, expiresAt, secret), expiresAt };
}

// ---------------------------------------------------------------------------
// What lock exists
// ---------------------------------------------------------------------------

export async function lockState(admin: Admin, userId: string) {
  const { data: settings, error } = await admin
    .from("user_security_settings")
    .select("app_lock_enabled,pin_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not verify app lock settings.");
  const { data: creds, error: cErr } = await admin
    .from("user_webauthn_credentials")
    .select("credential_id")
    .eq("user_id", userId);
  // Before the credentials table exists, no key can be enrolled, so there are none. Any OTHER
  // failure is not "no keys": it stops the check instead of reading as an unlocked account.
  if (cErr && !/42P01|PGRST205|does not exist|schema cache/i.test(`${cErr.code ?? ""} ${cErr.message ?? ""}`)) {
    throw new Error("Could not verify app lock settings.");
  }
  const credentialCount = cErr ? 0 : (creds ?? []).length;
  return {
    appLockEnabled: !!settings?.app_lock_enabled,
    hasPin: !!settings?.pin_hash,
    credentialCount,
    hasLock: !!settings?.pin_hash || credentialCount > 0,
  };
}

/**
 * Changing the lock while one exists needs proof the person unlocked this session.
 * If a read fails the answer is "no": never assume there is no lock.
 */
export async function requireUnlockProof(
  admin: Admin,
  userId: string,
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): Promise<void> {
  const s = await lockState(admin, userId);
  if (s.hasLock && !verifyToken(token, userId, secret, now)) throw new Error(LOCKED_MESSAGE);
}

// ---------------------------------------------------------------------------
// Biometric ceremony
// ---------------------------------------------------------------------------

type Purpose = "register" | "authenticate";

async function newChallenge(admin: Admin, userId: string, purpose: Purpose, now: number): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const challenge = b64urlEncode(bytes);
  const { error } = await admin.from("user_webauthn_challenges").insert({
    user_id: userId,
    purpose,
    challenge,
    expires_at: new Date(now + CHALLENGE_TTL_MS).toISOString(),
    created_at: new Date(now).toISOString(),
  });
  if (error) throw new Error("We couldn't start that. Try again in a moment.");
  return challenge;
}

/** Takes the newest unexpired challenge and removes it, so it can only be answered once. */
async function consumeChallenge(admin: Admin, userId: string, purpose: Purpose, now: number): Promise<string> {
  const { data } = await admin
    .from("user_webauthn_challenges")
    .select("id,challenge,expires_at")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new WebAuthnError("That request expired. Try again.");
  await admin.from("user_webauthn_challenges").delete().eq("id", data.id);
  if (Date.parse(data.expires_at as string) < now) throw new WebAuthnError("That request expired. Try again.");
  return data.challenge as string;
}

async function throttle(admin: Admin, userId: string, now: number) {
  const { data } = await admin
    .from("user_webauthn_challenges")
    .select("id")
    .eq("user_id", userId)
    .eq("purpose", "authenticate")
    .gte("created_at", new Date(now - UNLOCK_WINDOW_MS).toISOString());
  if ((data ?? []).length >= MAX_UNLOCK_CHALLENGES_PER_WINDOW) {
    throw new Error("Too many tries. Use your PIN, or wait a few minutes.");
  }
}

export type RpContext = { rpId: string; origin: string };

export async function beginEnroll(
  admin: Admin,
  userId: string,
  input: { token?: string | null; rp: RpContext; secret: string; now?: number },
) {
  const now = input.now ?? Date.now();
  await requireUnlockProof(admin, userId, input.token, input.secret, now);
  const challenge = await newChallenge(admin, userId, "register", now);
  const { data: existing } = await admin.from("user_webauthn_credentials").select("credential_id").eq("user_id", userId);
  return {
    challenge,
    rpId: input.rp.rpId,
    userHandle: b64urlEncode(new TextEncoder().encode(userId)),
    excludeCredentialIds: ((existing ?? []) as Array<{ credential_id: string }>).map((c) => c.credential_id),
  };
}

export type EnrollResponse = { clientDataJSON: string; attestationObject: string };

export async function finishEnroll(
  admin: Admin,
  userId: string,
  input: { response: EnrollResponse; rp: RpContext; secret: string; now?: number },
) {
  const now = input.now ?? Date.now();
  const challenge = await consumeChallenge(admin, userId, "register", now);
  const reg = await verifyRegistration({
    clientDataJSON: input.response.clientDataJSON,
    attestationObject: input.response.attestationObject,
    expectedChallenge: challenge,
    expectedOrigin: input.rp.origin,
    expectedRpId: input.rp.rpId,
  });
  const { error } = await admin.from("user_webauthn_credentials").insert({
    user_id: userId,
    credential_id: reg.credentialId,
    public_key_jwk: reg.publicKeyJwk,
    sign_count: reg.signCount,
    created_at: new Date(now).toISOString(),
  });
  if (error) {
    throw new Error(/duplicate|unique/i.test(error.message) ? "That device is already set up." : "We couldn't save that device. Try again.");
  }
  await admin.from("user_security_settings").upsert(
    { user_id: userId, biometric_enabled: true, app_lock_enabled: true, updated_at: new Date(now).toISOString() },
    { onConflict: "user_id" },
  );
  return { ok: true as const, ...issueToken(userId, input.secret, now) };
}

export async function beginUnlock(admin: Admin, userId: string, input: { rp: RpContext; now?: number }) {
  const now = input.now ?? Date.now();
  const { data } = await admin.from("user_webauthn_credentials").select("credential_id").eq("user_id", userId);
  const ids = ((data ?? []) as Array<{ credential_id: string }>).map((c) => c.credential_id);
  if (!ids.length) throw new Error("Biometric unlock isn't set up on this account.");
  await throttle(admin, userId, now);
  const challenge = await newChallenge(admin, userId, "authenticate", now);
  return { challenge, rpId: input.rp.rpId, allowCredentialIds: ids };
}

export type UnlockResponse = {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
};

export async function finishUnlock(
  admin: Admin,
  userId: string,
  input: { response: UnlockResponse; rp: RpContext; secret: string; now?: number },
) {
  const now = input.now ?? Date.now();
  const challenge = await consumeChallenge(admin, userId, "authenticate", now);
  const { data: cred } = await admin
    .from("user_webauthn_credentials")
    .select("id,public_key_jwk,sign_count")
    .eq("user_id", userId)
    .eq("credential_id", input.response.credentialId)
    .maybeSingle();
  if (!cred) throw new WebAuthnError("That device isn't set up on this account.");
  const { signCount } = await verifyAssertion({
    clientDataJSON: input.response.clientDataJSON,
    authenticatorData: input.response.authenticatorData,
    signature: input.response.signature,
    expectedChallenge: challenge,
    expectedOrigin: input.rp.origin,
    expectedRpId: input.rp.rpId,
    publicKeyJwk: cred.public_key_jwk as Jwk,
    storedSignCount: Number(cred.sign_count ?? 0),
  });
  await admin
    .from("user_webauthn_credentials")
    .update({ sign_count: signCount, last_used_at: new Date(now).toISOString() })
    .eq("id", cred.id);
  return { ok: true as const, ...issueToken(userId, input.secret, now) };
}

export async function removeBiometric(
  admin: Admin,
  userId: string,
  input: { token?: string | null; secret: string; now?: number },
) {
  await requireUnlockProof(admin, userId, input.token, input.secret, input.now);
  const { error } = await admin.from("user_webauthn_credentials").delete().eq("user_id", userId);
  if (error) throw new Error("We couldn't remove that. Try again in a moment.");
  await admin
    .from("user_security_settings")
    .update({ biometric_enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return { ok: true as const };
}

export { b64urlDecode };
