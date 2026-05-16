import { useState } from "react";
import { useSettings } from "@/lib/settings-context";
import { usePinLock } from "@/lib/pin-lock";

export function PinScreen() {
  const { settings } = useSettings();
  const { unlock } = usePinLock();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [locked, setLocked] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;
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
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-[28px] text-center">{settings.disguiseName}</h1>
        {locked ? (
          <p className="mt-8 text-center text-[14px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="input-pp text-center text-[24px] tracking-[0.5em]"
              placeholder="••••••"
              autoFocus
            />
            <button type="submit" disabled={pin.length !== 6} className="btn-primary w-full">Enter</button>
            {msg && <p className="text-center text-[13px]" style={{ color: "var(--muted-foreground)" }}>{msg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}