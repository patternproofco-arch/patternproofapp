import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertAttorneyProfile } from "@/lib/attorney-portal.functions";
import { toast } from "sonner";
import { PublicQuickExit } from "@/components/PublicQuickExit";

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
      toast("Saved. One last step to open the portal.");
      navigate({ to: "/setup" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={72} variant="attorney" />
          <div className="font-serif text-[28px] font-bold mt-3">Attorney portal</div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            A source-linked chronology instead of a folder of screenshots.
          </p>
        </div>

        {step === "auth" ? (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">
              {mode === "signup" ? "Create your attorney account" : "Sign in"}
            </h2>
            <form onSubmit={auth} className="mt-4 space-y-3">
              <input
                className="input-pp"
                type="email"
                required
                autoComplete="email"
                aria-label="Work email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input-pp"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-label="Password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
            <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="mt-4 w-full text-center text-[13px]" style={{ color: "var(--accent)" }}>
              {mode === "signup" ? "I already have an account" : "Create a new account"}
            </button>
            {mode === "signup" && (
              <p className="mt-4 text-center text-[12.5px]" style={{ color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                Next: tell us about your practice, then choose a plan — Solo attorney
                or Firm. Not ready to commit? <a href="/demo" style={{ color: "var(--accent)", textDecoration: "underline" }}>Review the demo</a> first.
              </p>
            )}
          </div>
        ) : (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">Tell clients who they're working with</h2>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <input
                className="input-pp"
                required
                autoComplete="name"
                aria-label="Full name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                className="input-pp"
                autoComplete="organization"
                aria-label="Firm name (optional)"
                placeholder="Firm name (optional)"
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-pp"
                  autoComplete="off"
                  aria-label="Bar number"
                  placeholder="Bar #"
                  value={bar}
                  onChange={(e) => setBar(e.target.value)}
                />
                <input
                  className="input-pp"
                  autoComplete="address-level1"
                  aria-label="Jurisdiction"
                  placeholder="Jurisdiction"
                  value={jur}
                  onChange={(e) => setJur(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Saving…" : "Enter portal"}
              </button>
            </form>
            <p className="mt-4 text-center text-[12.5px]" style={{ color: "var(--muted-foreground)", lineHeight: 1.5 }}>
              One step left: choose Solo ($297/mo) or Firm pricing to activate your portal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}