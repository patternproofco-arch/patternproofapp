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
import { getAppLockState } from "@/lib/app-lock.functions";
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
  const { hasPin, hasBiometric, isLocked, lock } = usePinLock();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ensureRole = useServerFn(ensureSurvivorRole);
  const roleChecked = useRef(false);
  const readAppLock = useServerFn(getAppLockState);
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

  // Seed local onboarded flag from server-side user metadata so returning
  // users on a new device / private browser / cleared storage don't get
  // pushed back through onboarding.
  useEffect(() => {
    if (loading || !user || settings.onboarded) return;
    const meta = (user.user_metadata ?? {}) as { onboarding_complete?: boolean; state?: string };
    if (meta.onboarding_complete) {
      update({ onboarded: true, ...(meta.state ? { state: meta.state } : {}) });
    }
  }, [loading, user, settings.onboarded, update]);

  useEffect(() => {
    if (!loading && user && !settings.onboarded && pathname !== "/onboarding") {
      const meta = (user.user_metadata ?? {}) as { onboarding_complete?: boolean };
      if (!meta.onboarding_complete) {
        navigate({ to: "/onboarding", replace: true });
      }
    }
  }, [loading, user, settings.onboarded, pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="label-eyebrow">Opening your space…</div>
      </div>
    );
  }

  // Lock screen only shows when the user has opted in (PIN or biometric).
  const localBiometric =
    typeof window !== "undefined" && !!localStorage.getItem("pp_biometric_cred_v1");

  // Server says a lock is on, but nothing on this device can open it — ask her
  // to sign back in rather than defaulting to unlocked.
  if (
    serverLockOn === true &&
    !hasPin &&
    !hasBiometric &&
    !localBiometric &&
    pathname !== "/onboarding"
  ) {
    return <LockRecoveryScreen />;
  }

  if ((hasPin || localBiometric) && isLocked && pathname !== "/onboarding") {
    return <PinScreen />;
  }

  return <AppShell />;
}
