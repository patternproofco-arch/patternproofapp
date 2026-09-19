import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { lovable } from "@/integrations/lovable";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { recordOrgReferral } from "@/lib/payments.functions";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { totpStatus, sessionNeedsMfa } from "@/lib/mfa";

type Mode = "login" | "signup";

async function postAuthPath(
  role: { role: string; is_org_partner?: boolean },
  redirectTo?: string,
): Promise<string> {
  if (await sessionNeedsMfa()) return "/mfa";
  if (role.role === "attorney" || role.role === "collaborator") {
    // Lookup failure must fail closed to sign-in — never treat as "needs enroll"
    // (enroll would open /trust under the attorney shell).
    const totp = await totpStatus();
    if (totp === "unknown") {
      await supabase.auth.signOut();
      return "/signin";
    }
    if (totp === "unenrolled") return "/trust";
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
      const rawMsg =
        err instanceof Error ? err.message : "Something didn't work. Try again in a moment.";
      // Never let a signup error confirm or deny that an email already has
      // an account — that's an enumeration channel a stalker could use to
      // check whether a specific person has signed up. Supabase's own
      // "already registered" wording (when it surfaces) is replaced with a
      // neutral message that reads the same either way.
      const enumeratesAccount =
        mode === "signup" && /already registered|already exists|already in use/i.test(rawMsg);
      const friendly = enumeratesAccount
        ? "Check your email to continue. If this address is new, confirm it to finish creating your account. If it's already registered, sign in instead."
        : mode === "login"
          ? "We couldn't sign you in. " + rawMsg
          : "We couldn't create your account. " + rawMsg;
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
            {mode === "login"
              ? "Your private PatternProof account."
              : "Create your free private account."}
          </p>
        </div>

        <div className="card-pp">
          <h1 className="font-serif text-[22px]">
            {mode === "login" ? "Welcome back." : "Start organizing your documentation."}
          </h1>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            {mode === "login"
              ? "Sign in to continue to your private PatternProof account."
              : "Add photos, messages, voice notes, and written entries to one private timeline. You choose what to share and who can see it."}
          </p>

          <div className="space-y-3 mb-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={consentBlocked}
              className="input-pp w-full flex items-center justify-center gap-2"
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

          <div
            className="my-4 flex items-center gap-3 text-[11px]"
            style={{ color: "var(--muted-foreground)", letterSpacing: 1.5 }}
          >
            <div className="flex-1 h-px" style={{ background: "var(--border, #B57E60)" }} />
            OR
            <div className="flex-1 h-px" style={{ background: "var(--border, #B57E60)" }} />
          </div>

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
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-pp"
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
                  style={{ color: "var(--accent)" }}
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
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}
            <button type="submit" disabled={busy || consentBlocked} className="btn-primary w-full">
              {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}
            </button>
          </form>
          <button
            type="button"
            onClick={() =>
              navigate({ to: mode === "login" ? "/signup" : "/signin", search: toggleSearch })
            }
            className="mt-4 w-full text-center text-[13px]"
            style={{ color: "var(--accent)" }}
          >
            {mode === "login"
              ? "New here? Create an account."
              : "Already have an account? Sign in."}
          </button>
        </div>

        <div
          className="mt-5 flex items-center justify-center gap-2 text-[11px]"
          style={{ color: "var(--muted-foreground)", letterSpacing: "2px", fontWeight: 600 }}
        >
          <Lock size={12} /> PRIVATE BY DEFAULT · ENCRYPTED IN TRANSIT
        </div>
      </div>
    </div>
  );
}
