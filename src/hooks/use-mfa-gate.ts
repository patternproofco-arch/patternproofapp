import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { resolveMfaGate } from "@/lib/mfa";

type MfaGateOptions = {
  /** If true, no verified authenticator means redirect to enrollTo. */
  requireEnrollment?: boolean;
  enrollTo?: "/trust" | "/two-factor" | "/security";
};

export type MfaGateState = {
  /** Still deciding — show a waiting state, never protected content. */
  checking: boolean;
  /**
   * The MFA state could not be determined. Only ever true when
   * requireEnrollment is set: those routes fail closed.
   */
  denied: boolean;
  retry: () => void;
};

/**
 * Send an AAL1 session with a verified authenticator to /mfa before app chrome.
 * On required routes an indeterminate result denies the route instead of
 * quietly opening it.
 */
export function useMfaGate(enabled: boolean, options: MfaGateOptions = {}): MfaGateState {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(enabled);
  const [denied, setDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requireEnrollment = options.requireEnrollment === true;
  const enrollTo = options.enrollTo ?? "/trust";

  const retry = useCallback(() => {
    setDenied(false);
    setChecking(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      setDenied(false);
      return;
    }
    let cancelled = false;
    setChecking(true);

    resolveMfaGate({ requireEnrollment })
      .then((decision) => {
        if (cancelled) return;
        if (decision === "challenge") {
          navigate({ to: "/mfa", replace: true });
          return;
        }
        if (decision === "enroll") {
          navigate({ to: enrollTo, replace: true });
          return;
        }
        if (decision === "deny") {
          setDenied(true);
          setChecking(false);
          return;
        }
        setDenied(false);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Unreachable in practice: resolveMfaGate already fails closed.
        setDenied(requireEnrollment);
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, navigate, requireEnrollment, enrollTo, attempt]);

  return { checking, denied, retry };
}
