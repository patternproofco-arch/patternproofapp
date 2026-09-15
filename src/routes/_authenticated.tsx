import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { AppShell } from "@/components/AppShell";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
import { useIdleLock } from "@/hooks/use-idle-lock";
import { PinScreen } from "@/components/PinScreen";
import { LockRecoveryScreen } from "@/components/LockRecoveryScreen";
import { getPinLockState } from "@/lib/pin-lock.functions";
import { RecordingProvider } from "@/lib/recording-context";
import { useMfaGate } from "@/hooks/use-mfa-gate";
import { testAccountRole } from "@/lib/test-accounts";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <SettingsProvider>
      <PinLockProvider>
        <RecordingProvider>
          <Gate />
        </RecordingProvider>
      </PinLockProvider>
    </SettingsProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { hasPin, hasBiometric, isLocked, ready: pinLockReady, lock } = usePinLock();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ensureRole = useServerFn(ensureSurvivorRole);
  const roleChecked = useRef(false);
  const readAppLock = useServerFn(getPinLockState);
  const [serverLockOn, setServerLockOn] = useState<boolean | null>(null);
  const [isSurvivor, setIsSurvivor] = useState<boolean | null>(null);
  const forcedRole = testAccountRole(user?.email);
  const mfaChecking = useMfaGate(!loading && !!user && !forcedRole);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    readAppLock()
      .then((r) => {
        if (!cancelled) setServerLockOn(!!r.app_lock_enabled);
      })
      .catch(() => {
        if (!cancelled) setServerLockOn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, readAppLock]);

  useIdleLock(
    !loading && !!user && (hasPin || hasBiometric) && !isLocked,
    settings.sessionTimeoutSec,
    lock,
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading || !user || roleChecked.current) return;
    roleChecked.current = true;
    const forced = testAccountRole(user.email);
    if (forced === "attorney") {
      setIsSurvivor(false);
      navigate({ to: "/clients", replace: true });
      return;
    }
    if (forced === "advocate") {
      setIsSurvivor(false);
      navigate({ to: "/advocate-cases", replace: true });
      return;
    }
    ensureRole()
      .then((r) => {
        setIsSurvivor(!!r.is_survivor);
        if (!r.is_survivor && r.roles.includes("attorney")) {
          navigate({ to: "/clients", replace: true });
          return;
        }
        if (!r.is_survivor && r.roles.includes("advocate")) {
          navigate({ to: r.is_org_partner ? "/org-portal" : "/advocate-cases", replace: true });
        }
      })
      .catch(() => {
        setIsSurvivor(true);
      });
  }, [loading, user, ensureRole, navigate]);

  const onboardingComplete = !!(