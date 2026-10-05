import { execSync } from "node:child_process";
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
  FRESH_SIGN_IN_MS,
  RESET_MAX_ATTEMPTS,
  removeBiometric,
  requireUnlockProof,
  resetPin,
  settleLockFlag,
  type Reauth,
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

describe("before the database update is applied", () => {
  const brokenCreds = (admin: ReturnType<typeof db>, error: { code?: string; message: string }) => {
    const orig = admin.from;
    admin.from = ((n: string) =>
      n === "user_webauthn_credentials"
        ? ({ select: () => ({ eq: async () => ({ data: null, error }) }) } as never)
        : orig(n)) as typeof admin.from;
  };

  it("a PIN user is not locked out just because the credentials table doesn't exist yet", async () => {
    const admin = db(withPin());
    brokenCreds(admin, { code: "42P01", message: 'relation "user_webauthn_credentials" does not exist' });
    const s = await lockState(admin, USER);
    expect(s).toMatchObject({ hasPin: true, credentialCount: 0, hasLock: true });
  });

  it("any other failure reading the credentials stops the check", async () => {
    const admin = db(withPin());
    brokenCreds(admin, { message: "connection reset" });
    await expect(lockState(admin, USER)).rejects.toThrow(/Could not verify/);
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


describe("forgot PIN", () => {
  const PASSWORD = "correct horse";
  const reauth = (over: Partial<Reauth> = {}): Reauth => ({
    hasPassword: true,
    lastSignInAt: null,
    checkPassword: async (p) => p === PASSWORD,
    ...over,
  });
  const forgot = (admin: ReturnType<typeof db>, password: string | undefined, over: Partial<Reauth> = {}, at = NOW) =>
    resetPin(admin, USER, { pin: "2468", password, reauth: reauth(over), secret: SECRET, now: at });
  const row = (admin: ReturnType<typeof db>) => admin.tables.user_security_settings![0]!;
  const withLockedPin = () => ({
    user_security_settings: [
      { user_id: USER, pin_hash: "old-hash", pin_salt: "old-salt", pin_failed_attempts: 5, pin_locked_until: "2026-10-04T12:20:00Z", app_lock_enabled: true },
    ],
  });

  it("with the right password, replaces the PIN, clears the PIN lockout and unlocks", async () => {
    const admin = db(withLockedPin());
    const r = await forgot(admin, PASSWORD);
    expect(r.ok).toBe(true);
    if (r.ok) expect(verifyToken(r.token, USER, SECRET, NOW + 1)).toBe(true);
    expect(row(admin).pin_hash).not.toBe("old-hash");
    expect(row(admin).pin_salt).not.toBe("old-salt");
    expect(row(admin).pin_failed_attempts).toBe(0);
    expect(row(admin).pin_locked_until).toBeNull();
    expect(JSON.stringify(row(admin))).not.toContain("2468");
  });

  it("works while the PIN is locked out, which is when people need it most", async () => {
    const admin = db(withLockedPin());
    expect((await forgot(admin, PASSWORD)).ok).toBe(true);
  });

  it("a wrong or missing password changes nothing and returns no token", async () => {
    const admin = db(withLockedPin());
    for (const pw of ["nope", "", undefined]) {
      const r = await forgot(admin, pw);
      expect(r).toEqual({ ok: false, result: "wrong" });
    }
    expect(row(admin).pin_hash).toBe("old-hash");
    expect(row(admin).reset_failed_attempts).toBe(3);
  });

  it("locks the reset out after repeated wrong passwords, even for the right one, then lets it through", async () => {
    const admin = db(withPin());
    let last: Awaited<ReturnType<typeof forgot>> = { ok: false, result: "wrong" };
    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) last = await forgot(admin, "nope");
    expect(last).toEqual({ ok: false, result: "locked-out" });
    expect(await forgot(admin, PASSWORD, {}, NOW + 60_000)).toEqual({ ok: false, result: "locked-out" });
    expect(row(admin).pin_hash).toBe("x");
    const later = await forgot(admin, PASSWORD, {}, NOW + 31 * 60_000);
    expect(later.ok).toBe(true);
    expect(row(admin).reset_failed_attempts).toBe(0);
  });

  it("an account with no password needs a sign-in from the last few minutes", async () => {
    const admin = db(withPin());
    const none = { hasPassword: false, checkPassword: async () => true };
    expect(await forgot(admin, undefined, { ...none, lastSignInAt: NOW - FRESH_SIGN_IN_MS - 1 })).toEqual({
      ok: false,
      result: "needs-fresh-sign-in",
    });
    expect(await forgot(admin, undefined, { ...none, lastSignInAt: null })).toEqual({
      ok: false,
      result: "needs-fresh-sign-in",
    });
    expect(row(admin).pin_hash).toBe("x");
    expect((await forgot(admin, undefined, { ...none, lastSignInAt: NOW - 60_000 })).ok).toBe(true);
  });

  it("a password-account can't skip the password by claiming a fresh sign-in", async () => {
    const admin = db(withPin());
    expect(await forgot(admin, undefined, { hasPassword: true, lastSignInAt: NOW })).toEqual({ ok: false, result: "wrong" });
  });

  it("refuses, changing nothing, when the counter can't be read, the password check is down, or the save fails", async () => {
    const readFails = db(withPin());
    const orig = readFails.from;
    readFails.from = ((n: string) =>
      n === "user_security_settings"
        ? ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "no such column" } }) }) }) } as never)
        : orig(n)) as typeof readFails.from;
    expect(await forgot(readFails, PASSWORD)).toEqual({ ok: false, result: "unavailable" });

    const checkDown = db(withPin());
    expect(
      await forgot(checkDown, PASSWORD, {
        checkPassword: async () => {
          throw new Error("auth service down");
        },
      }),
    ).toEqual({ ok: false, result: "unavailable" });
    expect(row(checkDown).pin_hash).toBe("x");

    const saveFails = db(withPin());
    const o2 = saveFails.from;
    saveFails.from = ((n: string) => {
      const t = o2(n) as unknown as Record<string, unknown>;
      return n === "user_security_settings"
        ? (Object.assign(Object.create(t), { upsert: async () => ({ error: { message: "down" } }) }) as never)
        : (t as never);
    }) as typeof saveFails.from;
    expect(await forgot(saveFails, PASSWORD)).toEqual({ ok: false, result: "unavailable" });
  });

  it("keeps enrolled devices: only the PIN is replaced", async () => {
    const admin = db(withPin());
    await enroll(admin, issueToken(USER, SECRET, NOW).token);
    expect((await forgot(admin, PASSWORD)).ok).toBe(true);
    expect((await lockState(admin, USER)).credentialCount).toBe(1);
  });
});

describe("reset wiring and settings lockdown (source contract)", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

  it("the PIN screen offers the reset, including while locked out, and the form labels its fields", () => {
    const screen = read("src/components/PinScreen.tsx");
    expect(screen).toMatch(/ForgotPinPanel/);
    expect(screen).toMatch(/Forgot your PIN\?/);
    const panel = read("src/components/ForgotPinPanel.tsx");
    expect(panel).toMatch(/htmlFor="reset-password"/);
    expect(panel).toMatch(/autoComplete="current-password"/);
    expect(panel).toMatch(/nothing was changed|Nothing was changed/i);
  });

  it("the reset is a server function that needs the account password, not just a session", () => {
    const fns = read("src/lib/pin-lock.functions.ts");
    expect(fns).toMatch(/resetPinServer/);
    expect(fns).toMatch(/signInWithPassword/);
    expect(fns).toMatch(/persistSession: false/);
  });

  it("the migration takes away direct browser access to the PIN hash and the lockout counters", () => {
    const sql = read("supabase/migrations/20261004250000_lock_reset_and_settings_lockdown.sql");
    expect(sql).toMatch(/DROP POLICY IF EXISTS "own security settings update"/);
    expect(sql).toMatch(/REVOKE ALL ON public\.user_security_settings FROM anon, authenticated/);
    expect(sql).toMatch(/reset_failed_attempts/);
  });

  it("no browser code reads or writes the settings table directly", () => {
    const hits = execSync(`grep -rln "user_security_settings" src --include=*.ts --include=*.tsx || true`, {
      cwd: new URL("../../", import.meta.url).pathname,
    })
      .toString()
      .split("\n")
      .filter((f) => f && !/__tests__|integrations\/supabase\/types|\.server\.ts$|\.functions\.ts$/.test(f));
    expect(hits).toEqual([]);
  });
});


describe("an orphaned lock, and turning the lock off on purpose", () => {
  const orphan = () => ({ user_security_settings: [{ user_id: USER, app_lock_enabled: true, biometric_enabled: true }] });

  it("a lock that is on but has nothing to unlock it still counts as locked", async () => {
    const admin = db(orphan());
    const s = await lockState(admin, USER);
    expect(s).toMatchObject({ hasPin: false, credentialCount: 0, usable: false, hasLock: true });
    // So an open session can't just set its own PIN here: it takes the password-checked reset.
    await expect(requireUnlockProof(admin, USER, undefined, SECRET, NOW)).rejects.toThrow(LOCKED_MESSAGE);
  });

  it("the reset repairs it: a PIN is saved after the password is checked", async () => {
    const admin = db(orphan());
    const r = await resetPin(admin, USER, {
      pin: "1357",
      password: "pw",
      reauth: { hasPassword: true, lastSignInAt: null, checkPassword: async (p) => p === "pw" },
      secret: SECRET,
      now: NOW,
    });
    expect(r.ok).toBe(true);
    expect((await lockState(admin, USER)).usable).toBe(true);
  });

  it("removing the last enrolled device turns the lock off instead of stranding the account", async () => {
    const admin = db();
    const { done } = await enroll(admin);
    await removeBiometric(admin, USER, { token: done.token, secret: SECRET, now: NOW + 1 });
    const row = admin.tables.user_security_settings![0]!;
    expect(row.app_lock_enabled).toBe(false);
    expect(row.biometric_enabled).toBe(false);
    expect((await lockState(admin, USER)).hasLock).toBe(false);
  });

  it("removing the device keeps the lock on while a PIN remains", async () => {
    const admin = db(withPin());
    const { done } = await enroll(admin, issueToken(USER, SECRET, NOW).token);
    await removeBiometric(admin, USER, { token: done.token, secret: SECRET, now: NOW + 1 });
    expect(admin.tables.user_security_settings![0]!.app_lock_enabled).toBe(true);
    expect((await lockState(admin, USER)).hasPin).toBe(true);
  });

  it("settling does nothing while something can still unlock, and does nothing when the lock is already off", async () => {
    const withPinRow = db(withPin());
    await settleLockFlag(withPinRow, USER);
    expect(withPinRow.tables.user_security_settings![0]!.app_lock_enabled).toBe(true);
    const off = db({ user_security_settings: [{ user_id: USER, app_lock_enabled: false }] });
    await settleLockFlag(off, USER);
    expect(off.tables.user_security_settings![0]!.app_lock_enabled).toBe(false);
  });
});

describe("the unlock signing secret", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  it("prefers a dedicated secret of 32+ characters and falls back to the service key", () => {
    const src = read("src/lib/pin-lock.functions.ts");
    expect(src).toMatch(/APP_LOCK_SIGNING_SECRET/);
    expect(src).toMatch(/dedicated\.length >= 32/);
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("recovery screen is not a way past the lock (source contract)", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  it("uses the server-checked reset, with no client-only password gate", () => {
    const src = read("src/components/LockRecoveryScreen.tsx");
    expect(src).toMatch(/ForgotPinPanel/);
    expect(src).not.toMatch(/signInWithPassword/);
    expect(src).not.toMatch(/setRealPin/);
  });
});
