import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCKED_MESSAGE,
  MAX_UNLOCK_CHALLENGES_PER_WINDOW,
  beginEnroll,
  beginUnlock,
  finishEnroll,
  finishUnlock,
  issueToken,
  lockState,
  removeBiometric,
  requireUnlockProof,
  signToken,
  verifyToken,
} from "@/lib/app-lock.server";
import { makeRwAdmin } from "./helpers/fake-rw-supabase";
import { ORIGIN, RP, assertion, jwkOf, registration, newKey, clientData } from "./helpers/webauthn-fixtures";
import { b64urlEncode } from "@/lib/webauthn.server";

const USER = "user-1";
const SECRET = "test-secret";
const rp = { rpId: RP, origin: ORIGIN };
const NOW = Date.parse("2026-10-04T12:00:00Z");

function db(over: Record<string, Array<Record<string, unknown>>> = {}) {
  return makeRwAdmin(
    {
      user_security_settings: [],
      user_webauthn_credentials: [],
      user_webauthn_challenges: [],
      ...over,
    },
    { uniques: { user_webauthn_credentials: ["credential_id"] } },
  );
}
const withPin = () => ({ user_security_settings: [{ user_id: USER, pin_hash: "x", app_lock_enabled: true }] });

/** A device enrolls through the real begin/finish flow and the server stores its key. */
async function enroll(admin: ReturnType<typeof db>, token?: string) {
  const start = await beginEnroll(admin, USER, { token, rp, secret: SECRET, now: NOW });
  const r = registration({ challenge: start.challenge });
  const done = await finishEnroll(admin, USER, { response: r.response, rp, secret: SECRET, now: NOW });
  return { start, r, done };
}

describe("unlock tokens", () => {
  it("verify only for the right user, unmodified and unexpired", () => {
    const { token } = issueToken(USER, SECRET, NOW);
    expect(verifyToken(token, USER, SECRET, NOW + 1000)).toBe(true);
    expect(verifyToken(token, "someone-else", SECRET, NOW + 1000)).toBe(false);
    expect(verifyToken(token, USER, "other-secret", NOW + 1000)).toBe(false);
    expect(verifyToken(token, USER, SECRET, NOW + 13 * 60 * 60 * 1000)).toBe(false);
    expect(verifyToken(token + "x", USER, SECRET, NOW)).toBe(false);
    expect(verifyToken(undefined, USER, SECRET, NOW)).toBe(false);
    expect(verifyToken(signToken(USER, NOW - 1, SECRET), USER, SECRET, NOW)).toBe(false);
  });
});

describe("changing the lock needs proof when a lock exists", () => {
  it("is open when there is no lock yet (first setup)", async () => {
    await requireUnlockProof(db(), USER, undefined, SECRET, NOW);
  });

  it("is refused with a PIN set and no valid token, and allowed with one", async () => {
    const admin = db(withPin());
    await expect(requireUnlockProof(admin, USER, undefined, SECRET, NOW)).rejects.toThrow(LOCKED_MESSAGE);
    await expect(requireUnlockProof(admin, USER, "garbage", SECRET, NOW)).rejects.toThrow(LOCKED_MESSAGE);
    const other = issueToken("someone-else", SECRET, NOW).token;
    await expect(requireUnlockProof(admin, USER, other, SECRET, NOW)).rejects.toThrow(LOCKED_MESSAGE);
    await requireUnlockProof(admin, USER, issueToken(USER, SECRET, NOW).token, SECRET, NOW);
  });

  it("an enrolled device counts as a lock too", async () => {
    const admin = db();
    await enroll(admin);
    await expect(requireUnlockProof(admin, USER, undefined, SECRET, NOW)).rejects.toThrow(LOCKED_MESSAGE);
  });

  it("a failed read never reads as 'no lock'", async () => {
    const admin = db();
    const orig = admin.from;
    admin.from = ((n: string) =>
      n === "user_security_settings"
        ? ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "down" } }) }) }) } as never)
        : orig(n)) as typeof admin.from;
    await expect(requireUnlockProof(admin, USER, undefined, SECRET, NOW)).rejects.toThrow();
  });
});

describe("enrolling a device", () => {
  it("stores the public key the device proved it holds, and marks the lock on", async () => {
    const admin = db();
    const { r, done } = await enroll(admin);
    expect(done.ok).toBe(true);
    expect(verifyToken(done.token, USER, SECRET, NOW + 1)).toBe(true);
    const row = admin.tables.user_webauthn_credentials![0]!;
    expect(row.credential_id).toBe(b64urlEncode(r.id));
    expect(row.public_key_jwk).toEqual(r.jwk);
    expect(JSON.stringify(row)).not.toMatch(/private|"d"/);
    expect((await lockState(admin, USER)).credentialCount).toBe(1);
  });

  it("a replayed enrollment fails: the challenge was used up", async () => {
    const admin = db();
    const start = await beginEnroll(admin, USER, { rp, secret: SECRET, now: NOW });
    const r = registration({ challenge: start.challenge });
    await finishEnroll(admin, USER, { response: r.response, rp, secret: SECRET, now: NOW });
    await expect(finishEnroll(admin, USER, { response: r.response, rp, secret: SECRET, now: NOW })).rejects.toThrow(/expired/);
  });

  it("an answer to a different challenge, or an expired one, is refused", async () => {
    const admin = db();
    await beginEnroll(admin, USER, { rp, secret: SECRET, now: NOW });
    const wrong = registration({ challenge: "not-the-one" });
    await expect(finishEnroll(admin, USER, { response: wrong.response, rp, secret: SECRET, now: NOW })).rejects.toThrow(
      /doesn't match/,
    );
    const start = await beginEnroll(admin, USER, { rp, secret: SECRET, now: NOW });
    const ok = registration({ challenge: start.challenge });
    await expect(
      finishEnroll(admin, USER, { response: ok.response, rp, secret: SECRET, now: NOW + 6 * 60 * 1000 }),
    ).rejects.toThrow(/expired/);
  });

  it("someone with only a session can't add their own device to a locked account", async () => {
    const admin = db(withPin());
    await expect(beginEnroll(admin, USER, { rp, secret: SECRET, now: NOW })).rejects.toThrow(LOCKED_MESSAGE);
    const token = issueToken(USER, SECRET, NOW).token;
    const start = await beginEnroll(admin, USER, { token, rp, secret: SECRET, now: NOW });
    expect(start.challenge.length).toBeGreaterThan(20);
  });

  it("another account's challenge can't be used", async () => {
    const admin = db();
    const start = await beginEnroll(admin, "user-2", { rp, secret: SECRET, now: NOW });
    const r = registration({ challenge: start.challenge });
    await expect(finishEnroll(admin, USER, { response: r.response, rp, secret: SECRET, now: NOW })).rejects.toThrow(/expired/);
  });
});

describe("unlocking with the device", () => {
  async function enrolled() {
    const admin = db();
    const pair = newKey();
    // Enroll a device whose private key we keep, so we can sign unlocks as that device.
    const start = await beginEnroll(admin, USER, { rp, secret: SECRET, now: NOW });
    const jwk = jwkOf(pair.publicKey);
    const reg = registration({ challenge: start.challenge });
    // Replace the generated key with ours so assertions verify against it.
    await finishEnroll(admin, USER, { response: reg.response, rp, secret: SECRET, now: NOW });
    admin.tables.user_webauthn_credentials![0]!.public_key_jwk = jwk;
    return { admin, pair, credentialId: b64urlEncode(reg.id) };
  }

  it("gives a token only for a real signature from the enrolled key", async () => {
    const { admin, pair, credentialId } = await enrolled();
    const start = await beginUnlock(admin, USER, { rp, now: NOW });
    expect(start.allowCredentialIds).toEqual([credentialId]);
    const a = assertion({ priv: pair.privateKey, challenge: start.challenge, count: 3 });
    const out = await finishUnlock(admin, USER, {
      response: { credentialId, ...a.wire },
      rp,
      secret: SECRET,
      now: NOW + 1000,
    });
    expect(verifyToken(out.token, USER, SECRET, NOW + 2000)).toBe(true);
    expect(admin.tables.user_webauthn_credentials![0]!.sign_count).toBe(3);
  });

  it("a signature from a different key gets nothing", async () => {
    const { admin, credentialId } = await enrolled();
    const start = await beginUnlock(admin, USER, { rp, now: NOW });
    const a = assertion({ challenge: start.challenge }); // signed by a stranger's key
    await expect(
      finishUnlock(admin, USER, { response: { credentialId, ...a.wire }, rp, secret: SECRET, now: NOW }),
    ).rejects.toThrow(/didn't match/);
  });

  it("a recorded unlock can't be replayed", async () => {
    const { admin, pair, credentialId } = await enrolled();
    const start = await beginUnlock(admin, USER, { rp, now: NOW });
    const a = assertion({ priv: pair.privateKey, challenge: start.challenge, count: 4 });
    await finishUnlock(admin, USER, { response: { credentialId, ...a.wire }, rp, secret: SECRET, now: NOW });
    await expect(
      finishUnlock(admin, USER, { response: { credentialId, ...a.wire }, rp, secret: SECRET, now: NOW }),
    ).rejects.toThrow(/expired/);
  });

  it("a device that isn't on this account is refused", async () => {
    const { admin, pair } = await enrolled();
    const start = await beginUnlock(admin, USER, { rp, now: NOW });
    const a = assertion({ priv: pair.privateKey, challenge: start.challenge });
    await expect(
      finishUnlock(admin, USER, { response: { credentialId: "unknown", ...a.wire }, rp, secret: SECRET, now: NOW }),
    ).rejects.toThrow(/isn't set up/);
  });

  it("an account with only the old database flag, and no enrolled key, can't unlock by biometrics", async () => {
    const admin = db({ user_security_settings: [{ user_id: USER, biometric_enabled: true, app_lock_enabled: true }] });
    await expect(beginUnlock(admin, USER, { rp, now: NOW })).rejects.toThrow(/isn't set up/);
    expect((await lockState(admin, USER)).credentialCount).toBe(0);
  });

  it("limits how many unlock attempts can be started", async () => {
    const { admin } = await enrolled();
    for (let i = 0; i < MAX_UNLOCK_CHALLENGES_PER_WINDOW; i++) await beginUnlock(admin, USER, { rp, now: NOW });
    await expect(beginUnlock(admin, USER, { rp, now: NOW })).rejects.toThrow(/Too many tries/);
    await beginUnlock(admin, USER, { rp, now: NOW + 11 * 60 * 1000 });
  });
});

describe("removing biometrics", () => {
  it("needs proof, then removes every key", async () => {
    const admin = db();
    await enroll(admin);
    await expect(removeBiometric(admin, USER, { secret: SECRET, now: NOW })).rejects.toThrow(LOCKED_MESSAGE);
    await removeBiometric(admin, USER, { token: issueToken(USER, SECRET, NOW).token, secret: SECRET, now: NOW });
    expect((await lockState(admin, USER)).credentialCount).toBe(0);
  });
});

describe("no way to get a token without proof", () => {
  const src = readFileSync("src/lib/pin-lock.functions.ts", "utf8");
  const client = readFileSync("src/lib/pin-lock.tsx", "utf8");

  it("the endpoints that minted tokens on a flag alone are gone", () => {
    expect(src).not.toContain("issueUnlockToken");
    expect(src).not.toContain("setBiometricEnabled");
    expect(client).not.toContain("issueUnlockToken");
    expect(client).not.toContain("setBiometricEnabled");
  });

  it("setting, clearing and removing the lock all go through the proof check", () => {
    const set = src.slice(src.indexOf("export const setPinServer"), src.indexOf("export const clearPinServer"));
    const clear = src.slice(src.indexOf("export const clearPinServer"), src.indexOf("export const verifyPinServer"));
    expect(set).toContain("requireUnlockProof");
    expect(clear).toContain("requireUnlockProof");
    expect(src).toContain("removeBiometric");
  });

  it("this device's storage no longer decides whether biometrics exist", () => {
    expect(client).not.toContain("localStorage");
  });

  it("an unlock never trusts the browser's own claim of success", () => {
    const unlock = client.slice(client.indexOf("const unlockBiometric"), client.indexOf("const disableBiometric"));
    expect(unlock).toContain("finishBiometricUnlock");
    expect(unlock.indexOf("finishBiometricUnlock")).toBeLessThan(unlock.indexOf("storeToken"));
  });

  it("origin and site come from the request the server saw, not from the page", () => {
    expect(src).toContain("getRequest().url");
  });
});
