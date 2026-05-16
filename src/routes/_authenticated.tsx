import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { SettingsProvider, useSettings } from "@/lib/settings-context";
import { PinLockProvider, usePinLock } from "@/lib/pin-lock";
import { PinScreen } from "@/components/PinScreen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <SettingsProvider>
      <PinLockProvider>
        <Gate />
      </PinLockProvider>
    </SettingsProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { hasPin, isLocked } = usePinLock();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && !settings.onboarded && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, user, settings.onboarded, pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="label-eyebrow">Opening your space…</div>
      </div>
    );
  }

  if (hasPin && isLocked && pathname !== "/onboarding") {
    return <PinScreen />;
  }

  return <AppShell />;
}