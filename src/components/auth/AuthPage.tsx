import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { lovable } from "@/integrations/lovable";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { recordOrgReferral } from "@/lib/payments.functions";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MARK_PATH, MARK_VIEWBOX } from "@/components/BrandMark";
import { hasVerifiedTotp, sessionNeedsMfa } from "@/lib/mfa";

type Mode = "login" | "signup";

/**
 * The one gradient rendering of the mark, reserved for this pre-login
 * moment. BrandMark's shared colorways stay flat/locked for every other
 * call site in the app (see BrandMark.tsx) — this reuses its exported
 * geometry directly rather than adding a gradient option there, so nothing
 * else in the app can pick it up by accident.
 */
function AuthMark({ size = 84 }: { size?: number }) {
  const gradientId = useId();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        background: "var(--paper)",
        boxShadow: "0 1px 2px rgba(26,25,22,0.05), 0 18px 34px -16px rgba(139,127,214,0.45)",
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox={MARK_VIEWBOX}
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        role="img"
        aria-label="PatternProof"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--pp-iridescent-pink)" />
            <stop offset="55%" stopColor="var(--pp-iridescent-violet)" />
            <stop offset="100%" stopColor="var(--pp-iridescent-teal)" />
          </linearGradient>
        </defs>
        <path d={MARK_PATH} fill={`url(#${gradientId})`} fillRule="evenodd" />
      </svg>
    </span>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pp-auth-field input-pp flex items-center gap-2" style={{ paddingRight: 8 }}>
      <input
        type={visible ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder="Password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="flex-shrink-0"
        style={{ color: "var(--muted-foreground)", padding: 4 }}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

/**
 * Shared guts of /signin and /signup — one component, two routes, so the
 * "New here? / Already have an account?" toggle can navigate between real
 * URLs instead of just flipping local state.
 */
async function postAuthPath(
  role: { role: string; is_org_partner?: boolean },
  redirectTo?: string,
): Promise<string> {
  if (await sessionNeedsMfa()) return "/mfa";
  if (role.role === "attorney" || role.role === "collaborator") {
    if (!(await hasVerifiedTotp())) return "/trust";
  }
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) return redirectTo;
  if (role.role === "attorney") return "/clients";
  if (role.role === "advocate") return role.is_org_partner ? "/org-portal" : "/advocate-cases";
  return "/dashboard";
}

export function AuthPage({
  mode,
  redirectTo,
  refSlug,
}: {
  mode: Mode;
  redirectTo?: string;
  refSlug?: string;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchRole = useServerFn(getMyRole);
  const recordReferral = useServerFn(recordOrgReferral);
  const ensureRole = useServerFn(ensureSurvivorRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const consentBlocked = mode === "signup" && !agreed;

  useEffect(() => {
    if (!loading && user) {
      if (refSlug && /^[A-Za-z0-9_-]{1,64}$/.test(refSlug)) {
        recordReferral({ data: { code: refSlug } }).catch(() => {});
      }
      fetchRole()
        .then(async (r) => {
          const to = await postAuthPath(r, redirectTo);
          navigate({ to, replace: true });
        })
        .catch(() => navigate({ to: "/dashboard", replace: true }));
    }
  }, [user, loading, navigate, fetchRole, redirectTo, refSlug, recordReferral]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              redirectTo && redirectTo.startsWith("/")
                ? window.location.origin + redirectTo
                : window.location.origin,
          },
        });
        if (error) throw error;
        await ensureRole().catch(() => undefined);
        if (redirectTo && redirectTo.startsWith("/")) {
          navigate({ to: redirectTo, replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const r = await fetchRole().catch(() => ({ role: "survivor" as const }));
        const to = await postAuthPath(r, redirectTo);
        navigate({ to, replace: true });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something didn't work. Try again in a moment.";
      const friendly =
        mode === "login"
          ? "We couldn't sign you in. " + msg
          : "We couldn't create your account. " + msg;
      setAuthError(friendly);
      toast(friendly);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (consentBlocked) {
      toast("Please review and check the box to agree to the Terms and Privacy Policy first.");
      return;
    }
    try {
      if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
        try {
          sessionStorage.setItem("pp_oauth_return", redirectTo);
        } catch {
          /* storage unavailable — the callback falls back to the role home */
        }
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth/callback",
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : "Try again in a moment.";
        toast("We couldn't reach Google. " + msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      toast("We couldn't reach Google. " + msg);
    }
  };

  const toggleSearch = {
    ...(redirectTo ? { redirect: redirectTo } : {}),
    ...(refSlug ? { ref: refSlug } : {}),
  };

  return (
    <div className="pp-auth-shell flex min-h-screen items-center justify-center px-5 py-12">
      <div className="pp-auth-wave" />
      <PublicQuickExit />
      <div className="relative w-full max-w-md" style={{ zIndex: 1 }}>
        <div className="mb-8 flex flex-col items-center text-center">
          <AuthMark size={84} />
          <div
            className="mt-5 text-[11px] font-semibold"
            style={{ color: "var(--pp-iridescent-violet)", letterSpacing: "0.22em" }}
          >
            PATTERNPROOF
          </div>
          <h1 className="mt-3 max-w-sm font-serif text-[30px] leading-[1.15]">
            {mode === "login" ? (
              "Welcome back."
            ) : (
              <>
                You're not just signing up. <em>You're being trusted with this.</em>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-sm text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            {mode === "login"
              ? "Sign in to your private PatternProof account."
              : "A private, evidence-grade record — built for the people who take your case seriously."}
          </p>
        </div>

        <div className="pp-auth-card px-7 py-8 sm:px-9">
          <div className="space-y-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={consentBlocked}
              className="pp-auth-google input-pp flex w-full items-center justify-center gap-2"
              style={{
                background: "#fff",
                color: "#2A1A10",
                fontWeight: 600,
                opacity: consentBlocked ? 0.55 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="pp-auth-divider my-6">or</div>

          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pp-auth-field input-pp"
            />
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {authError && (
              <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {authError}
              </p>
            )}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/forgot-password" })}
                  className="text-[12px]"
                  style={{ color: "var(--pp-iridescent-violet)", fontWeight: 600 }}
                >
                  Forgot your password?
                </button>
              </div>
            )}
            {mode === "signup" && (
              <label
                className="flex items-start gap-2 text-[13px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-[3px]"
                />
                <span>
                  I have read and agree to the{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--pp-iridescent-violet)", textDecoration: "underline" }}
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--pp-iridescent-violet)", textDecoration: "underline" }}
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={busy || consentBlocked}
              className="pp-auth-submit w-full rounded-2xl py-3 text-[14.5px] font-semibold text-white"
            >
              {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}
            </button>
          </form>
          <button
            type="button"
            onClick={() =>
              navigate({ to: mode === "login" ? "/signup" : "/signin", search: toggleSearch })
            }
            className="mt-5 w-full text-center text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {mode === "login" ? (
              <>
                New here?{" "}
                <span style={{ color: "var(--pp-iridescent-violet)", fontWeight: 600 }}>
                  Create an account.
                </span>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <span style={{ color: "var(--pp-iridescent-violet)", fontWeight: 600 }}>
                  Sign in.
                </span>
              </>
            )}
          </button>
        </div>

        <div
          className="mt-6 flex items-center justify-center gap-2 text-[11px]"
          style={{ color: "var(--muted-foreground)", letterSpacing: "1.5px", fontWeight: 600 }}
        >
          <Lock size={12} /> PRIVATE BY DEFAULT · ENCRYPTED IN TRANSIT
        </div>
      </div>
    </div>
  );
}
