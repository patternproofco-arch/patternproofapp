import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { ensureSurvivorRole } from "@/lib/roles.functions";
import { AppShell } from "@/components/AppShell";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
import { useIdleLock } from "@/hooks/use-idle-lock";
import { PinScreen } from "@/components/PinScreen";
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

  // Auto-lock after inactivity — only meaningful once she's set up a PIN or
  // biometric unlock, otherwise there's nothing to unlock with.
  useIdleLock(
    !loading && !!user && (hasPin || hasBiometric) && !isLocked,
    settings.sessionTimeoutSec,
    lock
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
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
  if ((hasPin || (typeof window !== "undefined" && localStorage.getItem("pp_biometric_cred_v1"))) && isLocked && pathname !== "/onboarding") {
    return <PinScreen />;
  }

  return <AppShell />;
}