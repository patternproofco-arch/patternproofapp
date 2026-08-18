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
      { title: "PatternProof — Sign in" },
      { name: "description", content: "Sign in or create your PatternProof account to privately document incidents, evidence, and build your case." },
      { property: "og:title", content: "Sign in — PatternProof" },
      { property: "og:description", content: "Access your private documentation space. Protected with per-user access controls and encrypted in transit." },
      { property: "og:url", content: "https://pattern-proof.tech/login" },
      { name: "twitter:title", content: "Sign in — PatternProof" },
      { name: "twitter:description", content: "Access your private documentation space. Protected with per-user access controls and encrypted in transit." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://pattern-proof.tech/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const homeForRole = (r: { role: string; is_org_partner?: boolean }) => {
    if (r.role === "attorney") return "/clients";
    if (r.role === "advocate") return "/org-portal";
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

  const signInWithApple = async () => {
    try {
      const returnTo =
        redirectTo && redirectTo.startsWith("/")
          ? window.location.origin + redirectTo
          : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: returnTo,
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : "Try again in a moment.";
        toast("We couldn't reach Apple. " + msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      toast("We couldn't reach Apple. " + msg);
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
              : "Create an account. Private by default. Protected with per-user access controls and encrypted in transit. You control what you share."}
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

            <button
              type="button"
              onClick={signInWithApple}
              className="input-pp w-full flex items-center justify-center gap-2"
              style={{ background: "#000", color: "#fff", fontWeight: 600 }}
            >
              <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Continue with Apple
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