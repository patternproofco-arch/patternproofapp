import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const PIN_KEY = "pp_pin_hash_v1";
const FAILS_KEY = "pp_pin_fails_v1";
const LOCK_UNTIL_KEY = "pp_pin_lock_until_v1";

async function hash(pin: string): Promise<string> {
  const enc = new TextEncoder().encode("pp::" + pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Ctx {
  hasPin: boolean;
  isLocked: boolean;
  setRealPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<"real" | "wrong" | "locked-out">;
  lock: () => void;
}

const PinCtx = createContext<Ctx | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const [hasPin, setHasPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = !!localStorage.getItem(PIN_KEY);
    setHasPin(stored);
    if (stored) setIsLocked(true);
  }, []);

  const setRealPin = async (pin: string) => {
    localStorage.setItem(PIN_KEY, await hash(pin));
    setHasPin(true);
    setIsLocked(false);
  };

  const unlock = async (pin: string): Promise<"real" | "wrong" | "locked-out"> => {
    const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
    if (lockUntil > Date.now()) return "locked-out";

    const real = localStorage.getItem(PIN_KEY);
    const h = await hash(pin);
    if (real && h === real) {
      localStorage.setItem(FAILS_KEY, "0");
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

  const lock = () => { setIsLocked(true); };

  return (
    <PinCtx.Provider value={{ hasPin, isLocked, setRealPin, unlock, lock }}>
      {children}
    </PinCtx.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinCtx);
  if (!ctx) throw new Error("usePinLock must be used inside PinLockProvider");
  return ctx;
}