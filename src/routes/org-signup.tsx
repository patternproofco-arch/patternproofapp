import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getMyOrgMembership, setMyOrg } from "@/lib/org-portal.functions";
import { toast } from "sonner";
import { PublicQuickExit } from "@/components/PublicQuickExit";

export const Route = createFileRoute("/org-signup")({
  head: () => ({
    meta: [
      { title: "Partner organization access — PatternProof" },
      {
        name: "description",
        content:
          "Request access to the PatternProof partner portal for DV organizations, or sign in if you already have an invitation.",
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
  const readSetupState = useServerFn(getMyOrgSetupState);

  const [step, setStep] = useState<"auth" | "profile" | "pending">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [busy, setBusy] = useState(false);

  // Signed in already? Send them straight through if their organization
  // exists, let a verified partner finish setup, and tell everyone else
  // plainly that verification is still pending (never bounce them back).
  useEffect(() => {
    if (loading || !user || step !== "auth") return;
    let cancelled = false;
    readSetupState()
      .then((r) => {
        if (cancelled) return;
        if (r.hasOrg) {
          navigate({ to: "/org-portal", replace: true });
          return;
        }
        if (!r.approved) {
          setStep("pending");
          return;
        }
        if (r.suggested_org_name) setOrgName(r.suggested_org_name);
        if (r.suggested_contact_name) setContactName(r.suggested_contact_name);
        if (r.suggested_contact_role) setContactRole(r.suggested_contact_role);
        setStep("profile");
      })
      .catch(() => {
        if (!cancelled) setStep("pending");
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, step, navigate, readSetupState]);


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
      navigate({ to: "/org-portal", replace: true });
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
            <h2 className="font-serif text-[20px]">Request access or sign in</h2>
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Partner portals are invitation-only while we verify organizations. If you already have
              an invite, sign in below. If not, request access and we&apos;ll follow up.
            </p>
            <Link
              to="/support"
              className="btn-primary mt-4 flex w-full items-center justify-center"
              style={{ textDecoration: "none" }}
            >
              Request access
            </Link>
            <p className="mt-2 text-center text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              Use the support form (category: Login/access) with your organization name — or email{" "}
              <a href="mailto:pattern@pattern-proof.tech" style={{ color: "var(--accent)" }}>
                pattern@pattern-proof.tech
              </a>
              .
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
