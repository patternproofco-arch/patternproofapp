import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { AppShell } from "@/components/AppShell";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
import { useIdleLock } from "@/hooks/use-idle-lock";
import { PinScreen } from "@/components/PinScreen";
import { LockRecoveryScreen } from "@/components/LockRecoveryScreen";
import { RecordingProvider } from "@/lib/recording-context";
import { useMfaGate } from "@/hooks/use-mfa-gate";
import { resolvePortal, withAccessTimeout } from "@/lib/portal-access";

export const Route = createFileRoute("/_authenticated")({ component: AuthLayout });

function Waiting({ message = "Opening your space…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      {message}
    </div>
  );
}
function RetryAccess({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" role="alert">
      <p>We couldn’t verify your access. Your information stays hidden.</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}

export function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/signin", replace: true });
  }, [loading, user, navigate]);
  if (loading || !user) return <Waiting />;
  // Remount all role, MFA, settings and lock state when the account changes.
  return <RoleGate key={user.id} />;
}

function RoleGate() {
  const ensureRole = useServerFn(ensureSurvivorRole);
  const navigate = useNavigate();
  const [portal, setPortal] = useState<ReturnType<typeof resolvePortal> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mfaChecking = useMfaGate(true);
  useEffect(() => {
    let cancelled = false;
    setPortal(null);
    setFailed(false);
    withAccessTimeout(ensureRole())
      .then((result) => {
        if (!cancelled) setPortal(resolvePortal(result));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ensureRole, attempt]);
  useEffect(() => {
    if (portal && portal !== "survivor" && !mfaChecking) {
      void navigate({ to: portal, replace: true }).catch(() => setFailed(true));
    }
  }, [portal, mfaChecking, navigate]);
  if (failed) return <RetryAccess retry={() => setAttempt((n) => n + 1)} />;
  if (!portal || mfaChecking) return <Waiting />;
  if (portal !== "survivor") return <Waiting message="Taking you to your portal…" />;
  // Professionals never mount survivor PIN, settings or recording providers.
  return (
    <SettingsProvider>
      <PinLockProvider key={attempt}>
        <RecordingProvider>
          <SurvivorGate retry={() => setAttempt((n) => n + 1)} />
        </RecordingProvider>
      </PinLockProvider>
    </SettingsProvider>
  );
}

function SurvivorGate({ retry }: { retry: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { hasPin, hasBiometric, isLocked, ready, lock, appLockEnabled, loadError } = usePinLock();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onboardingComplete = user?.user_metadata?.onboarding_complete === true;
  useIdleLock(
    ready && !loadError && (hasPin || hasBiometric) && !isLocked,
    settings.sessionTimeoutSec,
    lock,
  );
  useEffect(() => {
    if (!ready || loadError || isLocked) return;
    const meta = user?.user_metadata ?? {};
    if (onboardingComplete && !settings.onboarded)
      update({ onboarded: true, ...(meta.state ? { state: meta.state } : {}) });
    else if (!onboardingComplete && settings.onboarded) update({ onboarded: false });
    if (!onboardingComplete && pathname !== "/onboarding")
      void navigate({ to: "/onboarding", replace: true });
  }, [
    ready,
    loadError,
    isLocked,
    user,
    onboardingComplete,
    settings.onboarded,
    update,
    pathname,
    navigate,
  ]);
  if (loadError) return <RetryAccess retry={retry} />;
  if (!ready) return <Waiting />;
  // Direct onboarding URLs cannot bypass an existing app lock.
  if (appLockEnabled && !hasPin && !hasBiometric) return <LockRecoveryScreen />;
  if ((hasPin || hasBiometric) && isLocked) return <PinScreen />;
  if (!onboardingComplete && pathname !== "/onboarding") return <Waiting />;
  return <AppShell />;
}
