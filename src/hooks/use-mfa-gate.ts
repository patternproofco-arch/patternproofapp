import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { sessionNeedsMfa } from "@/lib/mfa";

/** Send an AAL1 session with a verified authenticator to /mfa before app chrome. */
export function useMfaGate(enabled: boolean) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    sessionNeedsMfa()
      .then((needs) => {
        if (cancelled) return;
        if (needs) navigate({ to: "/mfa", replace: true });
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, navigate]);

  return checking;
}
