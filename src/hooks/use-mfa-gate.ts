import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { hasVerifiedTotp, sessionNeedsMfa } from "@/lib/mfa";

type MfaGateOptions = {
  /** If true, no verified authenticator means redirect to enrollTo. */
  requireEnrollment?: boolean;
  enrollTo?: "/trust" | "/two-factor" | "/security";
};

/** Send an AAL1 session with a verified authenticator to /mfa before app chrome. */
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
      const needsChallenge = await sessionNeedsMfa();
      if (cancelled) return;
      if (needsChallenge) {
        navigate({ to: "/mfa", replace: true });
        return;
      }
      if (requireEnrollment) {
        const enrolled = await hasVerifiedTotp();
        if (cancelled) return;
        if (!enrolled) {
          navigate({ to: enrollTo, replace: true });
          return;
        }
      }
      if (!cancelled) setChecking(false);
    };
    run().catch(() => {
      if (!cancelled) setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, navigate, requireEnrollment, enrollTo]);

  return checking;
}
