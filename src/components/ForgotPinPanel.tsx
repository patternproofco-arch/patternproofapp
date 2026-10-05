import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePinLock } from "@/lib/pin-lock";

const MUTED = { color: "var(--muted-foreground)" } as const;

/**
 * Forgot PIN. The lock is there to keep out someone who picks up an open session, so a session
 * alone can't replace the PIN: it takes the account password again, or, for an account with no
 * password (Google sign-in), a sign-in from the last few minutes. Checked on the server.
 */
export function ForgotPinPanel({
  onCancel,
  title = "Reset your PIN",
  intro,
}: {
  onCancel?: () => void;
  title?: string;
  /** Replaces the default explanation, e.g. on the recovery screen. */
  intro?: string;
}) {
  const { user } = useAuth();
  const { resetPin } = usePinLock();
  const providers = ((user?.app_metadata as { providers?: string[] } | undefined)?.providers ?? []) as string[];
  const usesPassword = providers.length === 0 || providers.includes("email");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return setNote("Choose a 4-digit PIN.");
    if (pin !== again) return setNote("Those two PINs don't match.");
    if (usesPassword && !password) return setNote("Enter your account password.");
    setBusy(true);
    setNote(null);
    const r = await resetPin(pin, usesPassword ? password : undefined);
    setBusy(false);
    if (r === "ok") return; // the lock screen drops once the server has saved the new PIN
    setPassword("");
    if (r === "wrong") setNote("That password didn't match. Try again.");
    else if (r === "locked-out") setNote("Too many tries. Please wait 30 minutes and try again.");
    else if (r === "needs-fresh-sign-in") setNeedsSignIn(true);
    else setNote("We couldn't reset your PIN just now. Nothing was changed. Try again in a moment.");
  };

  if (needsSignIn) {
    return (
      <div className="space-y-3 text-[13px]">
        <p style={MUTED}>
          To reset your PIN, sign out and sign in again with Google. Then come back here within a few minutes.
        </p>
        <button type="button" className="btn-primary w-full" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost w-full" onClick={onCancel}>
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Reset your PIN">
      <h2 className="font-serif text-[20px]">{title}</h2>
      <p className="text-[13px]" style={MUTED}>
        {intro ??
          (usesPassword
            ? "Enter your account password to confirm it's you, then choose a new PIN. Your entries aren't affected."
            : "You sign in with Google, so we'll check you signed in just now, then you can choose a new PIN. Your entries aren't affected.")}
      </p>
      {usesPassword && (
        <>
          <label htmlFor="reset-password" className="label-eyebrow">
            Account password
          </label>
          <input
            id="reset-password"
            className="input-pp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      )}
      <label htmlFor="reset-pin" className="label-eyebrow">
        New PIN (4 digits)
      </label>
      <input
        id="reset-pin"
        className="input-pp"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
      <label htmlFor="reset-pin-again" className="label-eyebrow">
        Type the new PIN again
      </label>
      <input
        id="reset-pin-again"
        className="input-pp"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        maxLength={4}
        value={again}
        onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Checking…" : "Reset PIN"}
      </button>
      {onCancel && (
        <button type="button" className="btn-ghost w-full" onClick={onCancel}>
          Back
        </button>
      )}
      {note && (
        <p role="alert" className="text-[13px]" style={MUTED}>
          {note}
        </p>
      )}
    </form>
  );
}
