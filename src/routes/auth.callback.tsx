import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { useServerFn } from "@tanstack/react-start";

// -----------------------------------------------------------------------------
// Where Google (and the other managed providers) send people back to.
//
// In a full-page sign-in the browser leaves the app entirely, so the tokens
// arrive on this URL and nothing has stored them yet. Without this page the
// person lands back on a signed-out screen and it looks like the button did
// nothing. This route is public on purpose: the session does not exist yet
// when it loads.
// -----------------------------------------------------------------------------

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — PATTERNPROOF" },
      { name: "description", content: "Finishing sign-in and returning you to your space." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Signing you in — PATTERNPROOF" },
      { property: "og:description", content: "Finishing sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

const RETURN_KEY = "pp_oauth_return";

/** Tokens can arrive in the query string or the hash, depending on the flow. */
function readTokens(): {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  type?: string;
} {
  const out: Record<string, string> = {};
  const take = (params: URLSearchParams) => {
    for (const k of ["access_token", "refresh_token", "error", "error_description", "type"]) {
      const v = params.get(k);
      if (v && !out[k]) out[k] = v;
    }
  };
  take(new URLSearchParams(window.location.search));
  take(new URLSearchParams(window.location.hash.replace(/^#/, "")));
  return {
    access_token: out.access_token,
    refresh_token: out.refresh_token,
    error: out.error_description ?? out.error,
    type: out.type,
  };
}

function safeReturnPath(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* storage unavailable — fall back to the role home */
  }
  return null;
}

function AuthCallback() {
  const navigate = useNavigate();
  const fetchRole = useServerFn(getMyRole);
  const ensureRole = useServerFn(ensureSurvivorRole);
  const [message, setMessage] = useState("One moment — finishing sign-in.");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const goHome = async (tokens: { access_token: string; refresh_token: string }) => {
    const res = await supabase.auth.setSession(tokens);
    if (res.error) {
      setMessage("We couldn't finish signing you in. Please try again.");
      setTimeout(() => navigate({ to: "/signin", replace: true }), 2500);
      return;
    }
    window.history.replaceState({}, "", "/auth/callback");

    await ensureRole().catch(() => undefined);

    const saved = safeReturnPath();
    if (saved) {
      navigate({ to: saved, replace: true });
      return;
    }
    const role = await fetchRole().catch(() => ({
      role: "survivor" as const,
      is_org_partner: false,
    }));
    if (role.role === "attorney") navigate({ to: "/clients", replace: true });
    else if (role.role === "advocate")
      navigate({
        to: "is_org_partner" in role && role.is_org_partner ? "/org-portal" : "/advocate-cases",
        replace: true,
      });
    else navigate({ to: "/dashboard", replace: true });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetBusy(true);
    try {
      if (resetPassword.length < 8) {
        setResetError("Password must be at least 8 characters.");
        setResetBusy(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: resetPassword });
      if (error) throw error;
      setResetPassword("");
      setMessage("Password updated. Signing you in…");
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await goHome({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        } else {
          navigate({ to: "/signin", replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      setResetError("We couldn't update your password. " + msg);
    } finally {
      setResetBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const go = (to: string) => {
      if (!cancelled) navigate({ to, replace: true });
    };

    const finish = async () => {
      const { access_token, refresh_token, error, type } = readTokens();

      if (error) {
        setMessage("We couldn't finish signing you in. Please try again.");
        setTimeout(() => go("/signin"), 2500);
        return;
      }

      if (access_token && refresh_token) {
        // Recovery flow: show password reset form instead of auto-redirecting
        if (type === "recovery") {
          const res = await supabase.auth.setSession({ access_token, refresh_token });
          if (res.error) {
            setMessage("We couldn't finish signing you in. Please try again.");
            setTimeout(() => go("/signin"), 2500);
            return;
          }
          window.history.replaceState({}, "", "/auth/callback");
          setShowResetForm(true);
          return;
        }

        // Normal OAuth flow
        const res = await supabase.auth.setSession({ access_token, refresh_token });
        if (res.error) {
          setMessage("We couldn't finish signing you in. Please try again.");
          setTimeout(() => go("/signin"), 2500);
          return;
        }
        window.history.replaceState({}, "", "/auth/callback");

        await ensureRole().catch(() => undefined);

        const saved = safeReturnPath();
        if (saved) {
          go(saved);
          return;
        }
        const role = await fetchRole().catch(() => ({
          role: "survivor" as const,
          is_org_partner: false,
        }));
        if (role.role === "attorney") go("/clients");
        else if (role.role === "advocate")
          go("is_org_partner" in role && role.is_org_partner ? "/org-portal" : "/advocate-cases");
        else go("/dashboard");
      } else {
        // No tokens on the URL: the wrapper may already have stored the session.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          go("/signin");
          return;
        }

        await ensureRole().catch(() => undefined);

        const saved = safeReturnPath();
        if (saved) {
          go(saved);
          return;
        }
        const role = await fetchRole().catch(() => ({
          role: "survivor" as const,
          is_org_partner: false,
        }));
        if (role.role === "attorney") go("/clients");
        else if (role.role === "advocate")
          go("is_org_partner" in role && role.is_org_partner ? "/org-portal" : "/advocate-cases");
        else go("/dashboard");
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, fetchRole, ensureRole]);

  if (showResetForm) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-5 py-10"
        data-portal="survivor"
        data-pp-paper=""
      >
        <div className="w-full max-w-md">
          <div className="card-pp">
            <h1 className="font-serif text-[22px]">Choose a new password.</h1>
            <p className="mt-2 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Your account is ready. Create a secure password to continue.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="New password (at least 8 characters)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="input-pp"
              />
              {resetError && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  {resetError}
                </p>
              )}
              <button type="submit" disabled={resetBusy} className="btn-primary w-full">
                {resetBusy ? "One moment…" : "Set password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      data-portal="survivor"
      data-pp-paper=""
    >
      <p style={{ color: "var(--ink-muted)", fontSize: 14 }}>{message}</p>
    </div>
  );
}
