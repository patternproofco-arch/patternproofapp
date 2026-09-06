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

  // The server remembers whether a lock is turned on, so clearing site data
  // can't quietly remove it.
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

  // Auto-lock after inactivity — only meaningful once they've set up a PIN or
  // biometric unlock, otherwise there's nothing to unlock with.
  useIdleLock(
    !loading && !!user && (hasPin || hasBiometric) && !isLocked,
    settings.sessionTimeoutSec,
    lock,
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/signin", replace: true });
  }, [user, loading, navigate]);

  // Backfill the survivor role for accounts created before roles were
  // persisted, and send attorney-only accounts to their own portal instead of
  // leaving them loose in the survivor app. Runs once per session.
  useEffect(() => {
    if (loading || !user || roleChecked.current) return;
    roleChecked.current = true;
    ensureRole()
      .then((r) => {
        if (!r.is_survivor && r.roles.includes("attorney")) {
          navigate({ to: "/clients", replace: true });
          return;
        }
        if (!r.is_survivor && r.roles.includes("advocate")) {
          navigate({ to: r.is_org_partner ? "/org-portal" : "/advocate-cases", replace: true });
        }
      })
      .catch(() => undefined);
  }, [loading, user, ensureRole, navigate]);

  // Server user_metadata.onboarding_complete is the source of truth.
  // Local settings.onboarded is only a cache (localStorage) and must never
  // let a fresh signup skip /onboarding — e.g. another account previously
  // finished setup on this browser.
  const onboardingComplete = !!(
    user &&
    ((user.user_metadata ?? {}) as { onboarding_complete?: boolean }).onboarding_complete
  );

  useEffect(() => {
    if (loading || !user) return;
    const meta = (user.user_metadata ?? {}) as { onboarding_complete?: boolean; state?: string };
    if (meta.onboarding_complete) {
      if (!settings.onboarded) {
        update({ onboarded: true, ...(meta.state ? { state: meta.state } : {}) });
      }
    } else if (settings.onboarded) {
      // Stale local flag (shared device / prior account) — clear it.
      update({ onboarded: false });
    }
  }, [loading, user, settings.onboarded, update]);

  useEffect(() => {
    if (!loading && user && !onboardingComplete && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, onboardingComplete, pathname, navigate]);

  if (loading || !user || !pinLockReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="label-eyebrow">Opening your space…</div>
      </div>
    );
  }

  // Fail closed: never render survivor app chrome until onboarding is done.
  if (!onboardingComplete && pathname !== "/onboarding") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="label-eyebrow">Opening your space…</div>
      </div>
    );
  }

  // Server says a lock is on, but nothing on this device can open it (e.g.
  // biometric enrollment is device-bound and site data was cleared) — ask her
  // to sign back in rather than defaulting to unlocked.
  if (serverLockOn === true && !hasPin && !hasBiometric && pathname !== "/onboarding") {
    return <LockRecoveryScreen />;
  }

  if ((hasPin || hasBiometric) && isLocked && pathname !== "/onboarding") {
    return <PinScreen />;
  }

  return <AppShell />;
}
