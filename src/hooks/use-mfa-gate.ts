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
    const run = async () => {
      const decision = await resolveMfaGate({ requireEnrollment });
      if (cancelled) return;
      switch (decision) {
        case "challenge":
          navigate({ to: "/mfa", replace: true });
          return;
        case "enroll":
          navigate({ to: enrollTo, replace: true });
          return;
        case "deny":
          // Fail closed: do not open portal chrome when enrollment is required
          // and assurance/factor lookup failed.
          navigate({ to: "/signin", replace: true });
          return;
        case "allow":
        default:
          if (!cancelled) setChecking(false);
          return;
      }
    };
    run().catch(() => {
      if (cancelled) return;
      if (requireEnrollment) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, navigate, requireEnrollment, enrollTo]);

  return checking;
}
