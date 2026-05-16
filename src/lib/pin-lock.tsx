import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/settings-context";

const PIN_KEY = "pp_pin_hash_v1";
const DECOY_KEY = "pp_decoy_hash_v1";
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
  isDecoyMode: boolean;
  setRealPin: (pin: string) => Promise<void>;
  setDecoyPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<"real" | "decoy" | "wrong" | "locked-out">;
  lock: () => void;
}

const PinCtx = createContext<Ctx | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [hasPin, setHasPin] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDecoyMode, setIsDecoyMode] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = !!localStorage.getItem(PIN_KEY);
    setHasPin(stored);
    if (stored) setIsLocked(true);
  }, []);

  const resetIdle = useCallback(() => {
    if (typeof window === "undefined") return;
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (!hasPin || isLocked) return;
    idleTimer.current = window.setTimeout(() => {
      setIsLocked(true);
      setIsDecoyMode(false);
    }, Math.max(15, settings.sessionTimeoutSec) * 1000);
  }, [hasPin, isLocked, settings.sessionTimeoutSec]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle));
    resetIdle();
    return () => events.forEach((e) => window.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  const setRealPin = async (pin: string) => {
    localStorage.setItem(PIN_KEY, await hash(pin));
    setHasPin(true);
    setIsLocked(false);
  };
  const setDecoyPin = async (pin: string) => {
    localStorage.setItem(DECOY_KEY, await hash(pin));
  };

  const unlock = async (pin: string): Promise<"real" | "decoy" | "wrong" | "locked-out"> => {
    const lockUntil = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
    if (lockUntil > Date.now()) return "locked-out";

    const real = localStorage.getItem(PIN_KEY);
    const decoy = localStorage.getItem(DECOY_KEY);
    const h = await hash(pin);
    if (real && h === real) {
      localStorage.setItem(FAILS_KEY, "0");
      setIsDecoyMode(false);
      setIsLocked(false);
      return "real";
    }
    if (decoy && h === decoy) {
      localStorage.setItem(FAILS_KEY, "0");
      setIsDecoyMode(true);
      setIsLocked(false);
      return "decoy";
    }
    const fails = Number(localStorage.getItem(FAILS_KEY) || 0) + 1;
    localStorage.setItem(FAILS_KEY, String(fails));
    if (fails >= 5) {
      localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + 30 * 60 * 1000));
      return "locked-out";
    }
    return "wrong";
  };

  const lock = () => { setIsLocked(true); setIsDecoyMode(false); };

  return (
    <PinCtx.Provider value={{ hasPin, isLocked, isDecoyMode, setRealPin, setDecoyPin, unlock, lock }}>
      {children}
    </PinCtx.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinCtx);
  if (!ctx) throw new Error("usePinLock must be used inside PinLockProvider");
  return ctx;
}