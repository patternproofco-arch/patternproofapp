import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { useServerFn } from "@tanstack/react-start";
import { sessionNeedsMfa, verifiedTotpFactorId } from "@/lib/mfa";

export const Route = createFileRoute("/mfa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PatternProof — Authenticator code" },
      { name: "description", content: "Enter the 6-digit code from your authenticator app." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MfaChallengePage,
});

function MfaChallengePage() {
  const navigate = useNavigate();
  const fetchRole = useServerFn(getMyRole);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goHome = async () => {
    const role = await fetchRole().catch(() => ({
      role: "survivor" as const,
      is_org_partner: false,
    }));
    if (role.role === "attorney") navigate({ to: "/clients", replace: true });
    else if (role.role === "advocate")
      navigate({
        to: "is_org_partner" in role && role.is_org_partner ? "/org-portal" : "/advocate-cases",
        replace: true,
      });
    else navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      const needs = await sessionNeedsMfa();
      if (!needs) {
        await goHome();
        return;
      }
      if (!cancelled) setReady(true);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const factorId = await verifiedTotpFactorId();
      if (!factorId) throw new Error("No authenticator is set up on this account.");
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: trimmed,
      });
      if (verifyError) throw verifyError;
      await goHome();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code didn't match. Try the next one.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-pp-paper="">
        <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
          One moment…
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      data-portal="survivor"
      data-pp-paper=""
    >
      <PublicQuickExit />
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={76} />
          <p
            className="font-nunito mt-3 text-[15px]"
            style={{ color: "var(--muted-foreground)", fontWeight: 500 }}
          >
            One more step.
          </p>
        </div>
        <div className="card-pp">
          <h1 className="font-serif text-[22px]">Authenticator code</h1>
          <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            Open the app you used to set this up and enter the 6-digit code. It changes every 30
            seconds.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input
              className="input-pp text-center tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error ? (
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "One moment…" : "Continue"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 w-full text-center text-[13px]"
            style={{ color: "var(--accent)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
