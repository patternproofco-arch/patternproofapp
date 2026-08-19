import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { GuideHelper } from "@/components/survivor/GuideHelper";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AmbientBackground } from "@/components/AmbientBackground";
import { BottomTabBar } from "@/components/BottomTabBar";
import { UtilityBar } from "@/components/UtilityBar";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBanner } from "@/components/NotificationBanner";
import { quickExit } from "@/lib/quick-exit";
import { FocusModeProvider } from "@/components/survivor/focus-mode";

/**
 * AppShell — quiet canvas.
 * Five-destination flat bottom tab bar, a small utility row for account-level
 * tools, and a persistent Quick Exit control that is never nested in a menu.
 */
export function AppShell() {
  const { settings } = useSettings();

  // Quick-exit shortcut: double-Esc
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
    <div className="min-h-screen w-full" data-density="survivor" data-persona="survivor" style={{ background: "var(--background)" }}>
      {/* Ambient pastel canvas behind everything */}
      <AmbientBackground />

      {/* Minimal logo strip (no chrome bar) — sits in normal flow */}
      <header
        className="no-print app-surface mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 pt-5 md:px-10 md:pt-6"
      >
        <span aria-hidden style={{ width: 1 }} />
        <BrandMark size={42} />
        <UtilityBar />
      </header>

      <NotificationBanner />

      {/* Focus mode dims page content only. Quick Exit, the tab bar and the
          record button are mounted outside this provider, so they can never be
          blurred, dimmed or covered by it. */}
      <FocusModeProvider>
        <main
          className="app-surface print-page mx-auto w-full max-w-6xl px-5 md:px-10"
          style={{
            paddingTop: 24,
            // bottom padding: tab bar height + safety
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)",
          }}
        >
          <Outlet />
        </main>
      </FocusModeProvider>

      {/* Persistent chrome */}
      <BottomTabBar />
      <GuideHelper />
      <FloatingRecordButton />
      <QuickExitButton />
    </div>
  );
}