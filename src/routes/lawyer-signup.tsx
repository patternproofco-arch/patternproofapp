import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertAttorneyProfile } from "@/lib/attorney-portal.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/lawyer-signup")({
  head: () => ({
    meta: [
      { title: "Attorney sign-in — PatternProof" },
      { name: "description", content: "Litigation intelligence portal for family-law attorneys handling DV and coercive control cases." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LawyerSignup,
});

function LawyerSignup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const upsert = useServerFn(upsertAttorneyProfile);

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [step, setStep] = useState<"auth" | "profile">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firm, setFirm] = useState("");
  const [bar, setBar] = useState("");
  const [jur, setJur] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && step === "auth") setStep("profile");
  }, [user, loading, step]);

  const auth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/lawyer-signup" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await upsert({
        data: {
          full_name: fullName,
          firm_name: firm || null,
          bar_number: bar || null,
          jurisdiction: jur || null,
          email: user.email ?? email,
        },
      });
      toast("Welcome to the litigation portal.");
      navigate({ to: "/clients" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="attorney" size={80} />
          <div className="font-serif text-[28px] font-bold mt-3">Attorney portal</div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Turn 40 hours of evidence review into 2.
          </p>
        </div>

        {step === "auth" ? (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">
              {mode === "signup" ? "Create your attorney account" : "Sign in"}
            </h2>
            <form onSubmit={auth} className="mt-4 space-y-3">
              <input className="input-pp" type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input-pp" type="password" required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
            <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="mt-4 w-full text-center text-[13px]" style={{ color: "var(--accent)" }}>
              {mode === "signup" ? "I already have an account" : "Create a new account"}
            </button>
          </div>
        ) : (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">Tell clients who they're working with</h2>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <input className="input-pp" required placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="input-pp" placeholder="Firm name (optional)" value={firm} onChange={(e) => setFirm(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input-pp" placeholder="Bar #" value={bar} onChange={(e) => setBar(e.target.value)} />
                <input className="input-pp" placeholder="Jurisdiction" value={jur} onChange={(e) => setJur(e.target.value)} />
              </div>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Saving…" : "Enter portal"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}