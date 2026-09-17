import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "PatternProof — Reset your password" },
      { name: "description", content: "Reset your password to regain access to your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password?reason=recovery",
      });
      setSubmitted(true);
      setEmail("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      toast("We couldn't send that link. " + msg);
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
            Let's get you back in.
          </p>
        </div>

        <div className="card-pp">
          {!submitted ? (
            <>
              <h1 className="font-serif text-[22px]">Reset your password.</h1>
              <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Enter your email address and we'll send you a link to choose a new password. Your
                records will stay exactly as you left them.
              </p>

              <form onSubmit={submit} className="space-y-3">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-pp"
                />
                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? "One moment…" : "Send reset link"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-serif text-[22px]">Check your email.</h1>
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                If that email has an account, we've sent a link to reset the password. It expires
                in 24 hours. The email never contains a password — only a link to set a new one.
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
