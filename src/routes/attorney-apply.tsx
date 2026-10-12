import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  applyAsAttorney,
  getMyAttorneyApplication,
  type AttorneyApplication,
} from "@/lib/founder-operations.functions";
import { BrandMark } from "@/components/BrandMark";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/attorney-apply")({
  head: () => ({
    meta: [
      { title: "Apply for attorney access — PatternProof" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AttorneyApply,
});

function AttorneyApply() {
  const { user, loading } = useAuth();
  const apply = useServerFn(applyAsAttorney);
  const getApplication = useServerFn(getMyAttorneyApplication);
  const [application, setApplication] = useState<AttorneyApplication | null>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(true);
  const [fullName, setFullName] = useState("");
  const [firm, setFirm] = useState("");
  const [bar, setBar] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
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
          setApplication(row);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("Could not load your review. Refresh to try again.");
          setChecking(true);
        }
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
            options: { emailRedirectTo: `${window.location.origin}/attorney-apply` },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword("");
      if (!result.data.session)
        setMessage("Check your email to confirm your account, then return here to apply.");
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
      const token = new URLSearchParams(window.location.search).get("invite") || undefined;
      await apply({
        data: {
          full_name: fullName,
          firm_name: firm,
          bar_number: bar,
          jurisdiction,
          invite_token: token,
        },
      });
      window.history.replaceState(null, "", "/attorney-apply");
      const { application: row } = await getApplication();
      setApplication(row);
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
      <h1 className="mt-5 font-serif text-3xl">Apply for attorney access</h1>
      <p className="my-4">
        We review your bar number and jurisdiction before you can open a client workspace.
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
          <Label htmlFor="apply-email">Work email</Label>
          <Input
            id="apply-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Label htmlFor="apply-password">Password</Label>
          <Input
            id="apply-password"
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
          <p>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
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
                : "Your application is awaiting review"}
          </h2>
          <p className="my-4">
            {application.status === "approved"
              ? "Approval lets you set up your attorney account. Each client chooses what to share with you."
              : "Client records remain unavailable. Contact support if you need to correct your application."}
          </p>
          {application.status === "approved" && (
            <Link to="/setup" className="btn-primary">
              Set up your account
            </Link>
          )}
          <p className="mt-4">
            <Link to="/support">Contact support</Link>
          </p>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p>Applying as {user.email}. Please send no client information.</p>
          <Label htmlFor="apply-name">Full name</Label>
          <Input
            id="apply-name"
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Label htmlFor="apply-firm">Firm or organization (optional)</Label>
          <Input
            id="apply-firm"
            maxLength={200}
            value={firm}
            onChange={(e) => setFirm(e.target.value)}
          />
          <Label htmlFor="apply-bar">Bar number</Label>
          <Input
            id="apply-bar"
            required
            maxLength={60}
            value={bar}
            onChange={(e) => setBar(e.target.value)}
          />
          <Label htmlFor="apply-jurisdiction">Licensing state or jurisdiction</Label>
          <Input
            id="apply-jurisdiction"
            required
            minLength={2}
            maxLength={120}
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
          />
          <Button disabled={busy} type="submit">
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        </form>
      )}
    </main>
  );
}
