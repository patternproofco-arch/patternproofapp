import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";
import { QuickExitButton } from "@/components/QuickExitButton";

export function PinScreen() {
  const { settings } = useSettings();
  const { unlock, hasPin, hasBiometric, unlockBiometric } = usePinLock();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [locked, setLocked] = useState(false);

  // Auto-prompt biometric on mount if it's the only method set up.
  useEffect(() => {
    if (hasBiometric && !hasPin) {
      void tryBio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryBio = async () => {
    const r = await unlockBiometric();
    if (r === "failed") setMsg("Biometric unlock didn't work. Try again.");
    if (r === "unsupported") setMsg("Biometric unlock isn't available on this device.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;
    const result = await unlock(pin);
    if (result === "locked-out") {
      setLocked(true);
      setMsg("Please try again in 30 minutes.");
    } else if (result === "wrong") {
      setMsg("That code didn't work. Try again.");
      setPin("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      {/* Always reachable, even locked — same control as the rest of the app. */}
      <QuickExitButton />
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-[28px] text-center">{settings.disguiseName}</h1>
        {locked ? (
          <p className="mt-8 text-center text-[14px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>
        ) : (
          <div className="mt-8 space-y-4">
            {hasBiometric && (
              <button
                type="button"
                onClick={tryBio}
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
              >
                <Fingerprint size={18} />
                Unlock with Face ID / fingerprint
              </button>
            )}
            {hasPin && (
              <form onSubmit={submit} className="space-y-3">
                {hasBiometric && (
                  <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>
                    <span className="h-px flex-1" style={{ background: "var(--border)" }} /> or PIN <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                  </div>
                )}
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="input-pp text-center text-[24px] tracking-[0.5em]"
                  placeholder="••••"
                  autoFocus={!hasBiometric}
                />
                <button type="submit" disabled={pin.length !== 4} className="btn-primary w-full">Enter</button>
              </form>
            )}
            {msg && <p className="text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}