import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
      { title: "Attorney access — PatternProof" },
      {
        name: "description",
        content:
          "Open one client share free, request a short walkthrough, or sign in if you already have an invitation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LawyerSignup,
});

function LawyerSignup() {
  const { user, loading } = useAuth();
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
            Received a client share link? Open that link directly and follow the access steps shown
            there.
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            A source-linked chronology instead of a folder of screenshots.
          </p>
        </div>

        {step === "auth" ? (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">Open one share, or sign in</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Opening one client share does not require a subscription. A paid seat unlocks notes and
              caseload. Paid workspaces are set up with the founder after that first share.
            </p>
            <a
              href="mailto:pattern@pattern-proof.tech?subject=Open%20one%20client%20share%20free"
              className="btn-primary mt-4 flex w-full items-center justify-center"
              style={{ textDecoration: "none" }}
            >
              Open one client share free
            </a>
            <p className="mt-2 text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Or request a 15-minute walkthrough at{" "}
              <a href="mailto:pattern@pattern-proof.tech?subject=Request%20a%2015-minute%20walkthrough" style={{ color: "var(--accent)" }}>
                pattern@pattern-proof.tech
              </a>
              . Please send no case files or client information.
            </p>
            <div
              className="my-4 text-center text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted-foreground)" }}
            >
              Already invited?
            </div>
            <form onSubmit={auth} className="mt-4 space-y-3">
              <input
                className="input-pp"
                type="email"
                required
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input-pp"
                type="password"
                required
                minLength={8}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "One moment…" : "Sign in"}
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
