import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicQuickExit } from "@/components/PublicQuickExit";
import { BrandMark } from "@/components/BrandMark";
import { getMyRole } from "@/lib/attorney-portal.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  markPasswordRecovery,
  urlLooksLikeRecovery,
} from "@/lib/password-recovery";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PatternProof — Choose a new password" },
      { name: "description", content: "Set a new password for your PatternProof account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const MIN_LEN = 8;

function readAuthParams() {
  const out: Record<string, string> = {};
  const take = (params: URLSearchParams) => {
    for (const k of ["code", "access_token", "refresh_token", "type", "reason", "error", "error_description"]) {
      const v = params.get(k);
      if (v && !out[k]) out[k] = v;
    }
  };
  take(new URLSearchParams(window.location.search));
  take(new URLSearchParams(window.location.hash.replace(/^#/, "")));
  return out;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const fetchRole = useServerFn(getMyRole);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const params = readAuthParams();
      if (params.type === "recovery" || params.reason === "recovery" || urlLooksLikeRecovery()) {
        markPasswordRecovery();
      }

      if (params.error) {
        if (!cancelled) {
          setExpired(true);
          setReady(true);
        }
        return;
      }

      try {
        if (params.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
          if (exchangeError) throw exchangeError;
          markPasswordRecovery();
        } else if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (sessionError) throw sessionError;
          markPasswordRecovery();
        }

        window.history.replaceState({}, "", "/reset-password");

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setExpired(true);
        }
      } catch {
        if (!cancelled) setExpired(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) {
      setError(`Password must be at least ${MIN_LEN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => {
        void goHome();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Try again in a moment.";
      setError("We couldn't update your password. " + msg);
    } finally {
      setBusy(false);
    }
  };

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
            Choose a new password.
          </p>
        </div>

        <div className="card-pp">
          {!ready ? (
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              One moment…
            </p>
          ) : expired ? (
            <>
              <h1 className="font-serif text-[22px]">This link has expired.</h1>
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Request a new reset link. The old one only works once, and it expires after a day.
              </p>
              <Link to="/forgot-password" className="btn-primary mt-4 inline-block w-full text-center">
                Send a new link
              </Link>
            </>
          ) : done ? (
            <>
              <h1 className="font-serif text-[22px]">Password updated.</h1>
              <p className="mt-2 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Taking you into your space…
              </p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-[22px]">Set a new password.</h1>
              <p className="mt-1 mb-5 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Your records stay exactly as you left them. Pick something only you will know.
              </p>
              <form onSubmit={submit} className="space-y-3">
                <input
                  type="password"
                  required
                  minLength={MIN_LEN}
                  autoComplete="new-password"
                  placeholder={`New password (at least ${MIN_LEN} characters)`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-pp"
                />
                <input
                  type="password"
                  required
                  minLength={MIN_LEN}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-pp"
                />
                {error ? (
                  <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                    {error}
                  </p>
                ) : null}
                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? "One moment…" : "Save password"}
                </button>
              </form>
            </>
          )}
        </div>

        <Link
          to="/signin"
          className="mt-4 block w-full text-center text-[13px]"
          style={{ color: "var(--accent)" }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
