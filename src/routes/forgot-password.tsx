import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";
import { passwordRecoveryRedirectTo } from "@/lib/password-recovery-redirect";
import { RESET_NETWORK, classifyResetResult, resetDiagnostics } from "@/lib/password-reset-request";
import { RECOVERY_EMAIL_INBOX_HINT } from "@/lib/email-templates/recovery.config";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      // Quiet tab title — avoid product / court / DV wording in the browser chrome.
      { title: "Account access" },
      {
        name: "description",
        content: "Request a one-time link to choose a new password for your account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

/**
 * Enumeration-safe reset request: the success screen is the same whether or not
 * the address has an account (Auth answers success for unknown addresses). It is
 * shown ONLY when Auth returned no error; every error is a calm role=alert with a
 * retry (src/lib/password-reset-request.ts).
 */
function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const redirectTo = passwordRecoveryRedirectTo(window.location.origin);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      // Success screen only when Auth returned no error (it already answers success
      // for unknown addresses, so this reveals nothing). Any error: calm retry message.
      const outcome = classifyResetResult(resetError);
      if (outcome.kind === "error") {
        const line = resetDiagnostics(outcome);
        if (line) console.warn(line);
        setError(outcome.message);
        return;
      }
      setSubmitted(true);
      setEmail("");
    } catch {
      setError(RESET_NETWORK);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      data-portal="survivor"
      data-pp-paper=""
    >
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={76} />
          <p
            className="font-nunito mt-3 text-[15px]"
            style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
          >
            Let&apos;s get you back in.
          </p>
        </div>

        <div className="card-pp">
          {!submitted ? (
            <>
              <h1 className="font-serif text-[22px]">Reset your password.</h1>
              <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Enter the email you use with this account. If that address has an account,
                we&apos;ll send a one-time link to choose a new password. Your records stay as you
                left them — this only changes how you sign in.
              </p>

              <form onSubmit={submit} className="space-y-3" noValidate>
                <input
                  aria-label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "forgot-password-error" : undefined}
                  className="input-pp"
                />
                {error ? (
                  <p
                    role="alert"
                    aria-live="assertive"
                    id="forgot-password-error"
                    data-testid="forgot-password-error"
                    className="rounded-xl px-3 py-2 text-[13px] font-semibold"
                    style={{
                      color: "#9B2C3E",
                      background: "rgba(155, 44, 62, 0.08)",
                      border: "1px solid rgba(155, 44, 62, 0.25)",
                    }}
                  >
                    {error}
                  </p>
                ) : null}
                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? "One moment…" : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-serif text-[22px]">Check your email.</h1>
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                If that email has an account, we&apos;ve sent a link to reset the password. It
                expires in about 24 hours. The message never contains a password — only a one-time
                link to set a new one. We do not confirm here whether an account exists.
              </p>
              <p className="mt-3 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                {RECOVERY_EMAIL_INBOX_HINT}
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/signin" })}
                className="btn-primary w-full mt-4"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate({ to: "/signin" })}
          className="mt-4 w-full text-center text-[13px]"
          style={{ color: "var(--accent)" }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
