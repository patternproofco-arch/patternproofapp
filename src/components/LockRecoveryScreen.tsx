import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePinLock } from "@/lib/pin-lock";
import { useAuth } from "@/lib/auth-context";

/**
 * Shown when the account has a screen lock turned on but this device no longer
 * holds the PIN or biometric credential — usually because site data was
 * cleared. She signs in again, then sets the lock back up.
 */
export function LockRecoveryScreen() {
  const { user } = useAuth();
  const { enableBiometric, biometricSupported, setRealPin } = usePinLock();
  const [step, setStep] = useState<"verify" | "setup">("verify");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const verify = async () => {
    if (!user?.email || !password) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    setBusy(false);
    if (error) {
      setNote("That password didn't match. Try again in a moment.");
      return;
    }
    setPassword("");
    setStep("setup");
  };

  const savePin = async () => {
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setNote("PIN should be 4 digits.");
      return;
    }
    await setRealPin(pin);
  };

  const enroll = async () => {
    const r = await enableBiometric();
    if (!r.ok) setNote(r.reason);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="card-pp w-full max-w-[420px]">
        {step === "verify" ? (
          <>
            <div className="label-eyebrow">Screen lock</div>
            <h1 className="mt-2 font-serif text-[24px] leading-tight">Let's confirm it's you.</h1>
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Your screen lock is on for this account, but this device doesn't have it saved
              anymore. Sign in with your account password to continue.
            </p>
            <input
              className="input-pp mt-4"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Account password"
            />
            <button className="btn-primary mt-3" disabled={busy} onClick={verify}>
              {busy ? "Checking…" : "Continue"}
            </button>
          </>
        ) : (
          <>
            <div className="label-eyebrow">Screen lock</div>
            <h1 className="mt-2 font-serif text-[24px] leading-tight">Set your lock back up.</h1>
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Choose a 4-digit PIN, or use your device's built-in screen lock.
            </p>
            <input
              className="input-pp mt-4"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
            <button className="btn-primary mt-3" onClick={savePin}>
              Save PIN
            </button>
            {biometricSupported ? (
              <button className="btn-ghost mt-2" onClick={enroll}>
                Use Face ID / Fingerprint / Device passcode
              </button>
            ) : null}
          </>
        )}
        {note ? (
          <p className="mt-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {note}
          </p>
        ) : null}
        <p className="mt-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          This screen lock helps deter casual access to your account. It is not a guarantee against
          someone with deeper technical access to this device.
        </p>
      </div>
    </div>
  );
}
