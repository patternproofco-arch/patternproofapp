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
} {
  const out: Record<string, string> = {};
  const take = (params: URLSearchParams) => {
    for (const k of ["access_token", "refresh_token", "error", "error_description"]) {
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

  useEffect(() => {
    let cancelled = false;

    const go = (to: string) => {
      if (!cancelled) navigate({ to, replace: true });
    };

    const finish = async () => {
      const { access_token, refresh_token, error } = readTokens();

      if (error) {
        setMessage("We couldn't finish signing you in. Please try again.");
        setTimeout(() => go("/signin"), 2500);
        return;
      }

      if (access_token && refresh_token) {
        const res = await supabase.auth.setSession({ access_token, refresh_token });
        if (res.error) {
          setMessage("We couldn't finish signing you in. Please try again.");
          setTimeout(() => go("/signin"), 2500);
          return;
        }
        // Clear the tokens out of the address bar before anything else renders.
        window.history.replaceState({}, "", "/auth/callback");
      } else {
        // No tokens on the URL: the wrapper may already have stored the session.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          go("/signin");
          return;
        }
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
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, fetchRole, ensureRole]);

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
