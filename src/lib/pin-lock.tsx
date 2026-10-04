import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPinLockState,
  setPinServer,
  resetPinServer,
  clearPinServer,
  verifyPinServer,
  beginBiometricEnroll,
  finishBiometricEnroll,
  beginBiometricUnlock,
  finishBiometricUnlock,
  removeBiometricServer,
  checkUnlockToken,
} from "@/lib/pin-lock.functions";

import { withAccessTimeout } from "@/lib/portal-access";

const UNLOCK_TOKEN_KEY = "pp_unlock_token_v2";

interface Ctx {
  appLockEnabled: boolean;
  loadError: boolean;
  hasPin: boolean;
  hasBiometric: boolean;
  biometricSupported: boolean;
  isLocked: boolean;
  /** True once we've asked the server whether a stored unlock token is still valid. */
  ready: boolean;
  setRealPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<boolean>;
  /** Forgot PIN: the account password (or a fresh sign-in) replaces the PIN. */
  resetPin: (
    pin: string,
    password?: string,
  ) => Promise<"ok" | "wrong" | "locked-out" | "needs-fresh-sign-in" | "unavailable">;
  unlock: (pin: string) => Promise<"real" | "wrong" | "locked-out" | "no-pin">;
  enableBiometric: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  unlockBiometric: () => Promise<"ok" | "failed" | "unsupported">;
  disableBiometric: () => Promise<boolean>;
  lock: () => void;
}

const PinCtx = createContext<Ctx | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  // Fail closed: nothing renders behind the lock screen until the server has
  // confirmed either there's no lock configured, or a stored token is valid.
  const [isLocked, setIsLocked] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    let cancelled = false;
    setReady(false);
    setIsLocked(true);
    setLoadError(false);
    setBiometricSupported(
      typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator.credentials?.create === "function",
    );

    (async () => {
      const state = await withAccessTimeout(getPinLockState());
      if (cancelled) return;
      setAppLockEnabled(state.app_lock_enabled);
      const serverHasPin = !!state?.has_pin;
      // Enrolled keys are held by the server; this device's storage decides nothing.
      const serverBiometric = !!state?.biometric_enabled;
      setHasPin(serverHasPin);
      setHasBiometric(serverBiometric);

      if (!serverHasPin && !serverBiometric) {
        setIsLocked(false);
        setReady(true);
        return;
      }
      const token = sessionStorage.getItem(UNLOCK_TOKEN_KEY);
      if (!token) {
        setIsLocked(true);
        setReady(true);
        return;
      }
      const check = await withAccessTimeout(checkUnlockToken({ data: { token } })).catch(() => ({
        valid: false,
      }));
      if (cancelled) return;
      if (check.valid) {
        setIsLocked(false);
      } else {
        sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
        setIsLocked(true);
      }
      setReady(true);
    })().catch(() => {
      if (!cancelled) {
        setLoadError(true);
        setIsLocked(true);
        setReady(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const storeToken = (token: string) => {
    sessionStorage.setItem(UNLOCK_TOKEN_KEY, token);
  };

  const proof = () => sessionStorage.getItem(UNLOCK_TOKEN_KEY) ?? undefined;

  const setRealPin = async (pin: string) => {
    // Replacing a lock that exists needs the token from unlocking this session.
    const r = await setPinServer({ data: { pin, unlockToken: proof() } });
    storeToken(r.token);
    setHasPin(true);
    setIsLocked(false);
  };

  const resetPin = async (pin: string, password?: string) => {
    try {
      const r = await resetPinServer({ data: { pin, password } });
      if (!r.ok) return r.result;
      storeToken(r.token);
      setHasPin(true);
      setIsLocked(false);
      return "ok" as const;
    } catch {
      return "unavailable" as const;
    }
  };

  /** Only reports done once the server has actually removed it. */
  const clearPin = async (): Promise<boolean> => {
    try {
      await clearPinServer({ data: { unlockToken: proof() } });
    } catch {
      return false;
    }
    setHasPin(false);
    if (!hasBiometric) {
      sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
    }
    return true;
  };

  const unlock = async (pin: string): Promise<"real" | "wrong" | "locked-out" | "no-pin"> => {
    const r = await verifyPinServer({ data: { pin } }).catch(() => ({ result: "wrong" as const }));
    if (r.result === "real") {
      storeToken(r.token);
      setIsLocked(false);
    }
    return r.result;
  };

  const lock = () => {
    sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
    if (hasPin || hasBiometric) setIsLocked(true);
  };

  const b64url = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const fromB64url = (str: string) => {
    const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
    const s = atob((str + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out.buffer;
  };

  const enableBiometric = async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!biometricSupported)
      return { ok: false, reason: "Your device doesn't support biometric unlock." };
    try {
      // The server issues the challenge and later checks the device's signature against it.
      const start = await beginBiometricEnroll({ data: { unlockToken: proof() } });
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: fromB64url(start.challenge),
          rp: { id: start.rpId, name: "PatternProof" },
          user: {
            id: fromB64url(start.userHandle),
            name: "patternproof-user",
            displayName: "PatternProof",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          excludeCredentials: start.excludeCredentialIds.map((id) => ({
            id: fromB64url(id),
            type: "public-key" as const,
          })),
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!cred) return { ok: false, reason: "Couldn't enroll. Try again." };
      const att = cred.response as AuthenticatorAttestationResponse;
      const r = await finishBiometricEnroll({
        data: {
          clientDataJSON: b64url(att.clientDataJSON),
          attestationObject: b64url(att.attestationObject),
        },
      });
      storeToken(r.token);
      setHasBiometric(true);
      setIsLocked(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Enrollment failed." };
    }
  };

  const unlockBiometric = async (): Promise<"ok" | "failed" | "unsupported"> => {
    if (!biometricSupported) return "unsupported";
    try {
      const start = await beginBiometricUnlock();
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: fromB64url(start.challenge),
          rpId: start.rpId,
          allowCredentials: start.allowCredentialIds.map((id) => ({
            id: fromB64url(id),
            type: "public-key" as const,
          })),
          userVerification: "required",
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!assertion) return "failed";
      const res = assertion.response as AuthenticatorAssertionResponse;
      // A token comes back only if the server verified the device's signature.
      const r = await finishBiometricUnlock({
        data: {
          credentialId: b64url(assertion.rawId),
          clientDataJSON: b64url(res.clientDataJSON),
          authenticatorData: b64url(res.authenticatorData),
          signature: b64url(res.signature),
        },
      }).catch(() => null);
      if (!r) return "failed";
      storeToken(r.token);
      setIsLocked(false);
      return "ok";
    } catch {
      return "failed";
    }
  };

  const disableBiometric = async (): Promise<boolean> => {
    try {
      await removeBiometricServer({ data: { unlockToken: proof() } });
    } catch {
      return false;
    }
    setHasBiometric(false);
    if (!hasPin) sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
    return true;
  };

  return (
    <PinCtx.Provider
      value={{
        appLockEnabled,
        loadError,
        hasPin,
        hasBiometric,
        biometricSupported,
        isLocked,
        ready,
        setRealPin,
        clearPin,
        resetPin,
        unlock,
        enableBiometric,
        unlockBiometric,
        disableBiometric,
        lock,
      }}
    >
      {children}
    </PinCtx.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinCtx);
  if (!ctx) throw new Error("usePinLock must be used inside PinLockProvider");
  return ctx;
}
