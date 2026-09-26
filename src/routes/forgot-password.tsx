import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "PatternProof — Reset your password" },
      {
        name: "description",
        content: "Request a link to choose a new password for your PatternProof account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

/**
 * Enumeration-safe reset request: the success screen is the same whether or not
 * the address has an account. Only transport / rate-limit failures surface as
 * visible role=alert errors (soft-claim copy; no absolute privacy promises).
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password?reason=recovery",
      });
      if (resetError) {
        const lower = resetError.message.toLowerCase();
        // Never reveal whether the email is registered.
        if (/rate limit|too many|over_request_rate|email rate/i.test(lower)) {
          setError("Too many attempts. Wait a minute and try again.");
          return;
        }
        if (/failed to fetch|network|timeout|load failed|fetch failed/i.test(lower)) {
          setError("We couldn't reach the reset service. Check your connection and try again.");
          return;
        }
        // Other API responses (including unknown-user) still show the calm success path.
      }
      setSubmitted(true);
      setEmail("");
    } catch {
      setError("We couldn't reach the reset service. Check your connection and try again.");
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
                Enter the email you use with PatternProof. If that address has an account, we&apos;ll
                send a link to choose a new password. Your records stay as you left them — this only
                changes how you sign in.
              </p>

              <form onSubmit={submit} className="space-y-3" noValidate>
                <input
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
