import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
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
  const { hasPin, isLocked } = usePinLock();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

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