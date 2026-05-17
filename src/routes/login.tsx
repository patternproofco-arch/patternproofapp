import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [welcome, setWelcome] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && !welcome) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, welcome, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setWelcome(true);
        setTimeout(() => navigate({ to: "/dashboard", replace: true }), 2400);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something didn't work. Try again in a moment.";
      toast("We couldn't sign you in. " + msg);
    } finally {
      setBusy(false);
    }
  };

  if (welcome) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-pp max-w-md text-center">
          <Lock size={28} style={{ color: "var(--safe)" }} className="mx-auto mb-4" />
          <h1 className="font-serif text-[28px] leading-tight">
            This is your space.
            <br />
            <em>Private, safe, and organized.</em>
          </h1>
          <p className="mt-4 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Taking you in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="font-serif text-[30px] font-bold" style={{ color: "var(--foreground)" }}>
            Pattern<span style={{ color: "var(--primary)" }}>·</span>Proof
          </div>
          <p className="mt-2 text-[14px]" style={{ color: "var(--muted-foreground)" }}>
            Private documentation for your case.
          </p>
        </div>

        <div className="card-pp">
          <h2 className="font-serif text-[22px]">
            {mode === "login" ? "Welcome back." : "Make space for your story."}
          </h2>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            {mode === "login"
              ? "Sign in to continue."
              : "Create an account. Only you can see what you write here."}
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
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
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
          <Lock size={12} /> END-TO-END ENCRYPTED
        </div>
      </div>
    </div>
  );
}