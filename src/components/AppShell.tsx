import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { GuideHelper } from "@/components/survivor/GuideHelper";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { QuickExitButton } from "@/components/QuickExitButton";
import { BottomTabBar } from "@/components/BottomTabBar";
import { UtilityBar } from "@/components/UtilityBar";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBanner } from "@/components/NotificationBanner";
import { WavyThread } from "@/components/WavyThread";
import { quickExit } from "@/lib/quick-exit";
import { FocusModeProvider } from "@/components/survivor/focus-mode";

export function AppShell() {
  const { settings } = useSettings();

  useEffect(() => {
    let last = 0;
    const exit = () => quickExit(settings.exitUrl);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - last < 500) exit();
        last = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settings.exitUrl]);

  return (
    <div
      className="pp-app-shell folio-page min-h-screen w-full"
      data-density="survivor"
      data-persona="survivor"
      style={{ background: "var(--paper)", position: "relative" }}
    >
      <WavyThread />
      <header className="pp-shell-header pp-app-chrome no-print app-surface mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pt-3 md:px-10 md:pt-3" style={{ position: "relative", zIndex: 1 }}>
        <span aria-hidden style={{ width: 1 }} />
        <BrandMark size={30} variant="ink" onDark />
        <UtilityBar />
      </header>
      <NotificationBanner />
      <FocusModeProvider>
        <main
          className="pp-app-main app-surface print-page mx-auto w-full max-w-6xl px-5 md:px-10"
          style={{
            position: "relative",
            zIndex: 1,
            paddingTop: 24,
            paddingLeft: 56,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)",
          }}
        >
          <Outlet />
        </main>
      </FocusModeProvider>
      <BottomTabBar />
      <GuideHelper />
      <FloatingRecordButton />
      <QuickExitButton />
    </div>
  );
}
