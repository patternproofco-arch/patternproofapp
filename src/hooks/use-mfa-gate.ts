import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { resolveMfaGate } from "@/lib/mfa";

type MfaGateOptions = {
  /** If true, no verified authenticator means redirect to enrollTo. Lookup/errors deny. */
  requireEnrollment?: boolean;
  enrollTo?: "/trust" | "/two-factor" | "/security";
};

/**
 * Gate app chrome until MFA decision is known.
 * When requireEnrollment is true: only allow / challenge / enroll — never error→allow.
 */
export function useMfaGate(enabled: boolean, options: MfaGateOptions = {}) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(enabled);
  const requireEnrollment = options.requireEnrollment === true;
  const enrollTo = options.enrollTo ?? "/trust";

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempt = 0;
    // Fail closed without signing out: an indeterminate check (network blip,
    // slow response) keeps the protected portal hidden and retries, instead of
    // ending the session and losing the attorney's place.
    const scheduleRetry = () => {
      if (cancelled || typeof window === "undefined") return;
      attempt += 1;
      const delay = Math.min(15000, 1500 * attempt);
      retryTimer = window.setTimeout(() => void run(), delay);
    };
    const run = async () => {
      let decision: Awaited<ReturnType<typeof resolveMfaGate>>;
      try {
        decision = await resolveMfaGate({ requireEnrollment });
      } catch {
        if (cancelled) return;
        if (requireEnrollment) scheduleRetry();
        else setChecking(false);
        return;
      }
      if (cancelled) return;
      switch (decision) {
        case "challenge":
          navigate({ to: "/mfa", replace: true });
          return;
        case "enroll":
          navigate({ to: enrollTo, replace: true });
          return;
        case "deny":
          setChecking(true);
          scheduleRetry();
          return;
        case "allow":
        default:
          setChecking(false);
          return;
      }
    };
    const onOnline = () => {
      if (retryTimer) clearTimeout(retryTimer);
      void run();
    };
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    void run();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, [enabled, navigate, requireEnrollment, enrollTo]);

  return checking;
}
