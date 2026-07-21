import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota",
  "Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
  "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah",
  "Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","Outside the US",
];

export function OnboardingModal() {
  const { user, loading } = useAuth();
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (loading || !user || dismissed) return null;
  if (user.user_metadata?.onboarding_complete) return null;

  const ready = agreePrivacy && agreeTerms && state.length > 0;

  const finish = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_complete: true, state },
      });
      if (error) throw error;
      setDismissed(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      toast("We couldn't save that. " + msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-onboarding-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-5 py-10"
      style={{ background: "rgba(78, 59, 49, 0.55)", backdropFilter: "blur(8px)" }}
    >
      <div className="card-pp w-full max-w-lg">
        <div className="mb-5 flex flex-col items-center text-center">
          <Logo variant="survivor" size={64} />
          <h1 id="pp-onboarding-title" className="font-serif mt-4" style={{ fontSize: 28, lineHeight: 1.2 }}>
            Before you begin
          </h1>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Two quick things, then you're in.
          </p>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-xl p-3 text-[12.5px]"
            style={{
              background: "rgba(255, 200, 120, 0.14)",
              border: "1px solid rgba(160, 90, 20, 0.25)",
              color: "#5A3A10",
              lineHeight: 1.55,
            }}
          >
            <strong>Safety note:</strong> If someone else may see this device, use a private
            browser window and clear history when you're done. PatternProof has a "Quick Exit"
            button (top-right) that redirects to Google, but it can't erase browser history or
            notifications. Consider turning off message previews on your lock screen.
          </div>
          <div>
            <h2 className="font-serif text-[16px] mb-2">Legal agreements</h2>
            <label className="flex items-start gap-2 text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-1"
              />
              <span>
                I have read and agree to the{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-[14px] cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-1"
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                  Terms of Service
                </a>
                .
              </span>
            </label>
          </div>

          <div>
            <h2 className="font-serif text-[16px] mb-1">What state are you in?</h2>
            <p className="text-[12px] mb-2" style={{ color: "var(--muted-foreground)" }}>
              Helps us surface relevant legal resources.
            </p>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="input-pp w-full"
              required
            >
              <option value="">Select your state…</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={finish}
            disabled={!ready || busy}
            className="btn-primary w-full"
            style={{ opacity: !ready || busy ? 0.5 : 1 }}
          >
            {busy ? "One moment…" : "I agree — take me in"}
          </button>
          {!ready && !busy && (
            <p className="text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              {(() => {
                const missing: string[] = [];
                if (!agreePrivacy) missing.push("Privacy Policy");
                if (!agreeTerms) missing.push("Terms of Service");
                if (!state) missing.push("your state");
                return `Still needed: ${missing.join(", ")}.`;
              })()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}