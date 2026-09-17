import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const MIN_LEN = 8;

export function ChangePasswordCard({
  className = "card-pp",
  headingClassName = "font-serif text-[19px]",
}: {
  className?: string;
  headingClassName?: string;
}) {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user?.email) {
      setError("We couldn't find an email on this account.");
      return;
    }
    if (next.length < MIN_LEN) {
      setError(`New password must be at least ${MIN_LEN} characters.`);
      return;
    }
    if (next !== confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    if (current === next) {
      setError("Pick a password that's different from the current one.");
      return;
    }
    setBusy(true);
    try {
      const check = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (check.error) {
        setError("Current password isn't right. Try again, or use Forgot password from sign-in.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      setError("We couldn't update your password. " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <KeyRound size={18} style={{ color: "var(--primary)" }} />
        <h2 className={headingClassName}>Account password</h2>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        Change the password you use to sign in. This is separate from the app PIN.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          className="input-pp"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          className="input-pp"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LEN}
          placeholder={`New password (at least ${MIN_LEN} characters)`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <input
          className="input-pp"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LEN}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error ? (
          <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "One moment…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
