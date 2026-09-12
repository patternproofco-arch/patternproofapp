import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: "Reset your password — PatternProof" },
      { name: "description", content: "Request a secure PatternProof password-reset link." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const arrivedFromRecoveryLink = useMemo(() => {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    return (
      url.searchParams.has("code") ||
      url.searchParams.get("type") === "recovery" ||
      url.hash.includes("type=recovery")
    );
  }, []);
  const canChoosePassword = !loading && Boolean(user) && arrivedFromRecoveryLink;

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/recovery`,
      });
      if (resetError) throw resetError;
      setMessage(
        "If an account exists for that email, a reset link is on its way. Check spam too."
      );
    } catch {
      setError("We couldn't request a reset link. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been changed. You can sign in now.");
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/signin", replace: true }), 900);
    } catch {
      setError("We couldn't change your password. The link may have expired; request a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10" data-portal="survivor">
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={76} />
          <p className="mt-3 text-[15px]" style={{ color: "var(--muted-foreground)" }}>
            Account recovery
          </p>
        </div>

        <div className="card-pp">
          <h1 className="font-serif text-[22px]">
            {canChoosePassword ? "Choose a new password." : "Reset your password."}
          </h1>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            {canChoosePassword
              ? "Use at least 8 characters."
              : "Enter the email connected to your account. We’ll send a private reset link."}
          </p>

          {canChoosePassword ? (
            <form onSubmit={savePassword} className="space-y-3">
              <label htmlFor="new-password" className="sr-only">New password</label>
              <input id="new-password" name="newPassword" type="password" minLength={8} required autoComplete="new-password" className="input-pp" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <label htmlFor="confirm-password" className="sr-only">Confirm new password</label>
              <input id="confirm-password" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" className="input-pp" placeholder="Confirm new password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-3">
              <label htmlFor="recovery-email" className="sr-only">Email address</label>
              <input id="recovery-email" name="email" type="email" required autoComplete="email" className="input-pp" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          {message ? <p role="status" className="mt-4 text-[13px]">{message}</p> : null}
          {error ? <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--destructive)" }}>{error}</p> : null}

          <Link to="/signin" search={{}} className="mt-5 block text-center text-[13px]" style={{ color: "var(--accent)" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
