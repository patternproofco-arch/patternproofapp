import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { upsertAttorneyProfile } from "@/lib/attorney-portal.functions";
import { toast } from "sonner";
import { PublicQuickExit } from "@/components/PublicQuickExit";

import { getAttorneyOffer, requestAttorneyOffer } from "@/lib/attorney-offer.functions";

export const Route = createFileRoute("/lawyer-signup")({
  loader: () => getAttorneyOffer(),
  head: () => ({
    meta: [
      { title: "Attorney access — PatternProof" },
      {
        name: "description",
        content:
          "Create an attorney profile, request access review, or sign in to your existing workspace.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LawyerSignup,
});

function LawyerSignup() {
  const { user, loading } = useAuth();
  const offer = Route.useLoaderData();
  const requestOffer = useServerFn(requestAttorneyOffer);
  const [creating, setCreating] = useState(true);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const upsert = useServerFn(upsertAttorneyProfile);

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
      setMessage("");
      if (offer.enabled && creating) {
        if (!consent) throw new Error("Please agree to the Terms and Privacy Policy.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/lawyer-signup" },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Check your inbox to confirm your account, then return here to sign in. If you already have an account, sign in instead.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      if (offer.enabled) await requestOffer();
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
              {offer.enabled && creating
                ? "Create your attorney account"
                : "Sign in to attorney access"}
            </h2>
            <p className="mt-2 text-[13px]">
              {offer.enabled
                ? "No card required for the first case. Attorney access review and client consent are required before opening shared records."
                : "The new first case offer is not active yet. Get the free kit and fictional sample while access is being prepared."}
            </p>
            {!offer.enabled && <Link to="/for-attorneys">Get the free intake kit</Link>}
            {offer.enabled && (
              <button
                type="button"
                className="mt-3 underline"
                onClick={() => {
                  setCreating(!creating);
                  setMessage("");
                }}
              >
                {creating ? "Already have an account? Sign in" : "Create a new account"}
              </button>
            )}
            <form onSubmit={auth} className="mt-4 space-y-3">
              <input
                className="input-pp"
                type="email"
                required
                aria-label="Work email"
                autoComplete="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input-pp"
                type="password"
                required
                minLength={8}
                aria-label="Password"
                autoComplete={creating ? "new-password" : "current-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {offer.enabled && creating && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the <Link to="/terms">Terms</Link> and{" "}
                    <Link to="/privacy">Privacy Policy</Link>.
                  </span>
                </label>
              )}
              {message && (
                <p role="alert" className="text-sm">
                  {message}
                </p>
              )}
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "One moment…" : offer.enabled && creating ? "Create account" : "Sign in"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">Tell clients who they're working with</h2>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <input
                className="input-pp"
                required
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <input
                className="input-pp"
                placeholder="Firm name (optional)"
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-pp"
                  placeholder="Bar #"
                  value={bar}
                  onChange={(e) => setBar(e.target.value)}
                />
                <input
                  className="input-pp"
                  placeholder="Jurisdiction"
                  value={jur}
                  onChange={(e) => setJur(e.target.value)}
                />
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
