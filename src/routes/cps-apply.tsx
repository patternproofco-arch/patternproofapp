import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { applyAsCpsWorker, getMyCpsApplication } from "@/lib/cps.functions";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cps-apply")({
  head: () => ({
    meta: [
      { title: "Apply for professional access — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CpsApply,
});

type Application = { status?: string } | null;

function CpsApply() {
  const { user, loading } = useAuth();
  const apply = useServerFn(applyAsCpsWorker);
  const getApplication = useServerFn(getMyCpsApplication);
  const [application, setApplication] = useState<Application>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(true);
  const [fullName, setFullName] = useState("");
  const [agency, setAgency] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [kind, setKind] = useState<"agency_caseworker" | "licensed_social_worker" | "gal_or_court">("agency_caseworker");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    getApplication()
      .then(({ application: row }) => {
        if (!cancelled) {
          setApplication(row as Application);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load your review. Refresh to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, getApplication]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = register
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/cps-apply` },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword("");
      if (!result.data.session)
        setMessage("Check your work email and click the link we sent, then return here to apply.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await apply({
        data: {
          full_name: fullName,
          agency_name: agency,
          jurisdiction,
          professional_type: kind,
          license_number: licenseNumber || undefined,
          license_state: licenseState || undefined,
        },
      });
      const { application: row } = await getApplication();
      setApplication(row as Application);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <PublicQuickExit />
      <BrandMark size={56} variant="attorney" />
      <h1 className="mt-5 font-serif text-3xl">Apply for professional access</h1>
      <p className="my-4">
        For child-protection caseworkers, social workers and court-appointed staff. Sign up with your
        work email: we confirm you can read it, and a government email at a listed agency can be
        approved right away. Anything else is reviewed by a person.
      </p>
      <p className="my-4 text-[13px]">
        Approval does not give you anyone's records. A survivor decides, one request at a time, what
        you can see, and she can end it at any time. Please send no case information here.
      </p>
      {message && (
        <p role="status" className="my-4">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading…</p>
      ) : !user ? (
        <form onSubmit={authenticate} className="space-y-4">
          <h2 className="font-serif text-xl">{register ? "Create your account" : "Sign in"}</h2>
          <Label htmlFor="cps-email">Work email</Label>
          <Input id="cps-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Label htmlFor="cps-password">Password</Label>
          <Input
            id="cps-password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 12 : 1}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {register && (
            <Label className="flex items-start gap-2">
              <input type="checkbox" required />I agree to the <Link to="/terms">Terms</Link> and{" "}
              <Link to="/privacy">Privacy Policy</Link>.
            </Label>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </Button>
          <Button type="button" variant="link" onClick={() => setRegister(!register)}>
            {register ? "Already have an account? Sign in" : "Create an account"}
          </Button>
        </form>
      ) : checking ? (
        <p role="status">Checking your review…</p>
      ) : application ? (
        <section aria-label="Application status">
          <h2 className="font-serif text-xl">
            {application.status === "approved"
              ? "Your application is approved"
              : application.status === "rejected"
                ? "Your application was declined"
                : application.status === "suspended"
                  ? "Your access is paused"
                  : "Your application is awaiting review"}
          </h2>
          {application.status === "approved" ? (
            <Link to="/cps-portal" className="btn-primary mt-4 inline-block">
              Open the portal
            </Link>
          ) : (
            <p className="my-4">Nothing is available to you until it is approved.</p>
          )}
          <p className="mt-4">
            <Link to="/support">Contact support</Link>
          </p>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p>Applying as {user.email}. Your account email must be your work email.</p>
          <Label htmlFor="cps-name">Full name</Label>
          <Input id="cps-name" required minLength={2} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Label htmlFor="cps-kind">Your role</Label>
          <select id="cps-kind" className="input-pp" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="agency_caseworker">Child-protection caseworker (agency employee)</option>
            <option value="licensed_social_worker">Licensed social worker</option>
            <option value="gal_or_court">Guardian ad litem or court staff</option>
          </select>
          <Label htmlFor="cps-agency">Agency or organization</Label>
          <Input id="cps-agency" required minLength={2} maxLength={200} value={agency} onChange={(e) => setAgency(e.target.value)} />
          <Label htmlFor="cps-jurisdiction">County and state</Label>
          <Input id="cps-jurisdiction" required minLength={2} maxLength={120} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} />
          {kind === "licensed_social_worker" && (
            <>
              <Label htmlFor="cps-license">License number</Label>
              <Input id="cps-license" maxLength={60} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              <Label htmlFor="cps-license-state">Licensing state</Label>
              <Input id="cps-license-state" maxLength={60} value={licenseState} onChange={(e) => setLicenseState(e.target.value)} />
            </>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      )}
    </main>
  );
}
