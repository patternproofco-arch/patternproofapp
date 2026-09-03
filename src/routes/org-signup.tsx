import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { setMyOrg } from "@/lib/org-portal.functions";
import { toast } from "sonner";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/org-signup")({
  head: () => ({
    meta: [
      { title: "Partner organization sign-up — PatternProof" },
      {
        name: "description",
        content: "Create your DV organization's free partner account on PatternProof.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrgSignup,
});

function OrgSignup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const createOrg = useServerFn(setMyOrg);

  const [step, setStep] = useState<"auth" | "profile">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && step === "auth") navigate({ to: "/org-portal", replace: true });
  }, [user, loading, step, navigate]);

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

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await createOrg({
        data: {
          org_name: orgName,
          contact_name: contactName,
          contact_role: contactRole || undefined,
          email: user.email ?? email,
        },
      });
      toast("Your organization is set up.");
      navigate({ to: "/org-portal" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create your organization.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={72} variant="advocate" />
          <div className="font-serif text-[28px] font-bold mt-3">Partner organizations</div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Free for every survivor your organization refers. No cost to you or them.
          </p>
        </div>

        {step === "auth" ? (
          <div className="card-pp">
            <h2 className="font-serif text-[20px]">Partner sign in</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              New partner accounts are invitation only while organization verification is completed.
            </p>
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
            <h2 className="font-serif text-[20px]">Tell us about your organization</h2>
            <form onSubmit={saveOrg} className="mt-4 space-y-3">
              <input
                className="input-pp"
                required
                minLength={2}
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <input
                className="input-pp"
                required
                placeholder="Your name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <input
                className="input-pp"
                placeholder="Your role (optional)"
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
              />
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Setting up…" : "Enter partner dashboard"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
