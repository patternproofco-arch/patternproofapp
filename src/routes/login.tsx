import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { lovable } from "@/integrations/lovable";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { recordOrgReferral } from "@/lib/payments.functions";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const out: { redirect?: string; ref?: string } = {};
    if (typeof s.redirect === "string") out.redirect = s.redirect;
    if (typeof s.ref === "string") out.ref = s.ref;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sign in — PatternProof" },
      { name: "description", content: "Sign in or create your PatternProof account to privately document incidents, evidence, and build your case." },
      { property: "og:title", content: "Sign in — PatternProof" },
      { property: "og:description", content: "Access your private, encrypted documentation space." },
      { property: "og:url", content: "https://project--f496a23a-1a8f-408f-b5e0-e96d5947d49c.lovable.app/login" },
      { name: "twitter:title", content: "Sign in — PatternProof" },
      { name: "twitter:description", content: "Access your private, encrypted documentation space." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://project--f496a23a-1a8f-408f-b5e0-e96d5947d49c.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const homeForRole = (r: { role: string; is_org_partner?: boolean }) => {
    if (r.role === "attorney") return "/clients";
    if (r.role === "advocate") return r.is_org_partner ? "/org-portal" : "/advocate-cases";
    return "/dashboard";
  };
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect: redirectTo, ref: refSlug } = Route.useSearch();
  const fetchRole = useServerFn(getMyRole);
  const recordReferral = useServerFn(recordOrgReferral);
  const ensureRole = useServerFn(ensureSurvivorRole);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined") {
      setPasskeyAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      // Best-effort: capture the org-referral slug once, after auth. RLS makes
      // this a no-op if the row already exists.
      if (refSlug && /^[A-Za-z0-9_-]{1,64}$/.test(refSlug)) {
        recordReferral({ data: { code: refSlug } }).catch(() => {});
      }
      if (redirectTo && redirectTo.startsWith("/")) {
        navigate({ to: redirectTo, replace: true });
        return;
      }
      fetchRole()
        .then((r) => navigate({ to: homeForRole(r), replace: true }))
        .catch(() => navigate({ to: "/dashboard", replace: true }));
    }
  }, [user, loading, navigate, fetchRole, redirectTo, refSlug, recordReferral]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        // Persist the survivor role immediately so it's a real grant, not an
        // absence of one. Best-effort: never block sign-up on it.
        await ensureRole().catch(() => undefined);
        if (redirectTo && redirectTo.startsWith("/")) {
          navigate({ to: redirectTo, replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (redirectTo && redirectTo.startsWith("/")) {
          navigate({ to: redirectTo, replace: true });
          return;
        }
        const r = await fetchRole().catch(() => ({ role: "survivor" as const }));
        navigate({ to: homeForRole(r), replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something didn't work. Try again in a moment.";
      toast("We couldn't sign you in. " + msg);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const returnTo =
        redirectTo && redirectTo.startsWith("/")
          ? window.location.origin + redirectTo
          : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: returnTo,
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

  const signInWithPasskey = async () => {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: "preferred",
          timeout: 60000,
        },
      });
      if (credential) {
        toast("Use your saved password with biometrics in your browser's password manager.");
      }
    } catch {
      setPasskeyAvailable(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={76} />
          <p className="font-nunito mt-3 text-[15px]" style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
            Private documentation for your case.
          </p>
        </div>

        <div className="card-pp">
          <h2 className="font-serif text-[22px]">
            {mode === "login" ? "\n" : "Make space for your story."}
          </h2>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            {mode === "login"
              ? "\n"
              : "Create an account. Private by default. Encrypted in transit and at rest. You control what you share."}
          </p>

          <div className="space-y-3 mb-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="input-pp w-full flex items-center justify-center gap-2"
              style={{ background: "#fff", color: "#2A1A10", fontWeight: 600 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            {passkeyAvailable && (
              <button
                type="button"
                onClick={signInWithPasskey}
                className="input-pp w-full flex items-center justify-center gap-2"
                style={{ background: "transparent", borderWidth: 1, borderStyle: "solid" }}
              >
                <Fingerprint size={18} />
                Sign in with Face ID / Touch ID
              </button>
            )}
          </div>

          <div className="my-4 flex items-center gap-3 text-[11px]" style={{ color: "var(--muted-foreground)", letterSpacing: 1.5 }}>
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
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create my account"}
            </button>
          </form>
          <button
            type="button"
            onPointerDown={(e) => {
              // On mobile, an input may hold focus + keyboard. A plain onClick
              // would only blur on first tap and require a second tap to fire.
              // pointerdown fires before focus changes — toggle immediately.
              e.preventDefault();
              (document.activeElement as HTMLElement | null)?.blur?.();
              setMode((m) => (m === "login" ? "signup" : "login"));
            }}
            onClick={(e) => e.preventDefault()}
            className="mt-4 w-full text-center text-[13px]"
            style={{ color: "var(--accent)" }}
          >
            {mode === "login" ? "New here? Create an account." : "Already have an account? Sign in."}
          </button>
        </div>

        <div
          className="mt-5 flex items-center justify-center gap-2 text-[11px]"
          style={{ color: "var(--muted-foreground)", letterSpacing: "2px", fontWeight: 600 }}
        >
          <Lock size={12} /> PRIVATE BY DEFAULT · ENCRYPTED IN TRANSIT &amp; AT REST
        </div>
      </div>
    </div>
  );
}