import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPinLockState,
  setPinServer,
  clearPinServer,
  verifyPinServer,
  setBiometricEnabled,
  issueUnlockToken,
  checkUnlockToken,
} from "@/lib/pin-lock.functions";

const UNLOCK_TOKEN_KEY = "pp_unlock_token_v2";
const BIO_CRED_KEY = "pp_biometric_cred_v1";

interface Ctx {
  hasPin: boolean;
  hasBiometric: boolean;
  biometricSupported: boolean;
  isLocked: boolean;
  /** True once we've asked the server whether a stored unlock token is still valid. */
  ready: boolean;
  setRealPin: (pin: string) => Promise<void>;
  clearPin: () => void;
  unlock: (pin: string) => Promise<"real" | "wrong" | "locked-out" | "no-pin">;
  enableBiometric: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  unlockBiometric: () => Promise<"ok" | "failed" | "unsupported">;
  disableBiometric: () => void;
  lock: () => void;
}

const PinCtx = createContext<Ctx | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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
    const bio = !!localStorage.getItem(BIO_CRED_KEY);
    setBiometricSupported(
      typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator.credentials?.create === "function",
    );

    (async () => {
      const state = await getPinLockState().catch(() => null);
      if (cancelled) return;
      const serverHasPin = !!state?.has_pin;
      const serverBiometric = !!state?.biometric_enabled && bio;
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
      const check = await checkUnlockToken({ data: { token } }).catch(() => ({ valid: false }));
      if (cancelled) return;
      if (check.valid) {
        setIsLocked(false);
      } else {
        sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
        setIsLocked(true);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const storeToken = (token: string) => {
    sessionStorage.setItem(UNLOCK_TOKEN_KEY, token);
  };

  const setRealPin = async (pin: string) => {
    const r = await setPinServer({ data: { pin } });
    storeToken(r.token);
    setHasPin(true);
    setIsLocked(false);
  };

  const clearPin = () => {
    void clearPinServer().catch(() => undefined);
    setHasPin(false);
    if (!hasBiometric) {
      sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
    }
  };

  const unlock = async (pin: string): Promise<"real" | "wrong" | "locked-out" | "no-pin"> => {
    const r = await verifyPinServer({ data: { pin } }).catch(
      () => ({ result: "wrong" as const }),
    );
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
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const webauthnUserId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "PatternProof" },
          user: { id: webauthnUserId, name: "patternproof-user", displayName: "PatternProof" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
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
      localStorage.setItem(BIO_CRED_KEY, b64url(cred.rawId));
      await setBiometricEnabled({ data: { enabled: true } });
      const r = await issueUnlockToken();
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
    const credId = localStorage.getItem(BIO_CRED_KEY);
    if (!credId) return "unsupported";
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: fromB64url(credId), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (!assertion) return "failed";
      const r = await issueUnlockToken().catch(() => null);
      if (!r) return "failed";
      storeToken(r.token);
      setIsLocked(false);
      return "ok";
    } catch {
      return "failed";
    }
  };

  const disableBiometric = () => {
    localStorage.removeItem(BIO_CRED_KEY);
    void setBiometricEnabled({ data: { enabled: false } }).catch(() => undefined);
    setHasBiometric(false);
    if (!hasPin) sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
  };

  return (
    <PinCtx.Provider
      value={{
        hasPin,
        hasBiometric,
        biometricSupported,
        isLocked,
        ready,
        setRealPin,
        clearPin,
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
