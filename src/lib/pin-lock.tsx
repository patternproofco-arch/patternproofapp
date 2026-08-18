import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { setAppLockEnabled } from "@/lib/app-lock.functions";

const PIN_KEY = "pp_pin_hash_v1";
const FAILS_KEY = "pp_pin_fails_v1";
const LOCK_UNTIL_KEY = "pp_pin_lock_until_v1";
const SESSION_UNLOCKED_KEY = "pp_session_unlocked_v1";
const BIO_CRED_KEY = "pp_biometric_cred_v1";

/** Per-account salt: the same PIN on two accounts no longer shares a hash. */
async function hash(pin: string, userId: string | null): Promise<string> {
  const enc = new TextEncoder().encode(`pp::${userId ?? "anon"}::${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pre-salt format, kept only so an existing PIN still opens once and is then re-saved. */
async function legacyHash(pin: string): Promise<string> {
  const enc = new TextEncoder().encode("pp::" + pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Ctx {
  hasPin: boolean;
  hasBiometric: boolean;
  biometricSupported: boolean;
  isLocked: boolean;
  setRealPin: (pin: string) => Promise<void>;
  clearPin: () => void;
  unlock: (pin: string) => Promise<"real" | "wrong" | "locked-out">;
  enableBiometric: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  unlockBiometric: () => Promise<"ok" | "failed" | "unsupported">;
  disableBiometric: () => void;
  lock: () => void;
}

const PinCtx = createContext<Ctx | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [hasPin, setHasPin] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = !!localStorage.getItem(PIN_KEY);
    const bio = !!localStorage.getItem(BIO_CRED_KEY);
    setHasPin(stored);
    setHasBiometric(bio);
    setBiometricSupported(
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials?.create === "function"
    );
    if (stored || bio) {
      const sessionUnlocked = sessionStorage.getItem(SESSION_UNLOCKED_KEY);
      setIsLocked(!sessionUnlocked);
    }
  }, []);

  const syncServerLock = (enabled: boolean) => {
    void setAppLockEnabled({ data: { enabled } }).catch(() => undefined);
  };

  const setRealPin = async (pin: string) => {
    localStorage.setItem(PIN_KEY, await hash(pin, userId));
    setHasPin(true);
    setIsLocked(false);
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
    syncServerLock(true);
  };

  const clearPin = () => {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(FAILS_KEY);
    localStorage.removeItem(LOCK_UNTIL_KEY);
    setHasPin(false);
    if (!hasBiometric) syncServerLock(false);
  };

  const unlock = async (pin: string): Promise<"real" | "wrong" | "locked-out"> => {
    const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
    if (lockUntil > Date.now()) return "locked-out";

    const real = localStorage.getItem(PIN_KEY);
    const h = await hash(pin, userId);
    const matches = !!real && (h === real || (await legacyHash(pin)) === real);
    if (matches) {
      // Quietly upgrade a pre-salt hash to the per-account one.
      if (real !== h) localStorage.setItem(PIN_KEY, h);
      localStorage.setItem(FAILS_KEY, "0");
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
      setIsLocked(false);
      return "real";
    }
    const fails = Number(localStorage.getItem(FAILS_KEY) || 0) + 1;
    localStorage.setItem(FAILS_KEY, String(fails));
    if (fails >= 5) {
      localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + 30 * 60 * 1000));
      return "locked-out";
    }
    return "wrong";
  };

  const lock = () => {
    sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
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
    if (!biometricSupported) return { ok: false, reason: "Your device doesn't support biometric unlock." };
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "PatternProof" },
          user: { id: userId, name: "patternproof-user", displayName: "PatternProof" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!cred) return { ok: false, reason: "Couldn't enroll. Try again." };
      localStorage.setItem(BIO_CRED_KEY, b64url(cred.rawId));
      setHasBiometric(true);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
      setIsLocked(false);
      syncServerLock(true);
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
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
      setIsLocked(false);
      return "ok";
    } catch {
      return "failed";
    }
  };

  const disableBiometric = () => {
    localStorage.removeItem(BIO_CRED_KEY);
    setHasBiometric(false);
    if (!hasPin) syncServerLock(false);
  };

  return (
    <PinCtx.Provider value={{ hasPin, hasBiometric, biometricSupported, isLocked, setRealPin, clearPin, unlock, enableBiometric, unlockBiometric, disableBiometric, lock }}>
      {children}
    </PinCtx.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinCtx);
  if (!ctx) throw new Error("usePinLock must be used inside PinLockProvider");
  return ctx;
}