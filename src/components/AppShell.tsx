import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { QuickExitButton } from "@/components/QuickExitButton";
import { BottomTabBar } from "@/components/BottomTabBar";
import { UtilityBar } from "@/components/UtilityBar";
import { SideNav } from "@/components/survivor/SideNav";
import { PpCubeMark } from "@/components/survivor/PpCubeMark";
import { NotificationBanner } from "@/components/NotificationBanner";
import { quickExit } from "@/lib/quick-exit";
import "@/styles/survivor.css";

/**
 * AppShell — forest-green rail + white workspace.
 * Desktop: fixed left navigation and a sticky utility bar.
 * Mobile: the same destinations via the bottom tab bar.
 * Quick Exit stays visible everywhere and is never nested in a menu.
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
    <div className="pp-portal pp-shell w-full" data-density="survivor" data-persona="survivor">
      <SideNav />

      <div className="pp-main">
        <header className="pp-topbar no-print">
          <div className="flex items-center gap-2 lg:hidden">
            <PpCubeMark size={26} onDark={false} />
            <span className="pp-sidebar__wordmark" style={{ color: "var(--sv-green-900)" }}>
              PatternProof
            </span>
          </div>
          <UtilityBar />
        </header>

        <NotificationBanner />

        <main
          className="app-surface print-page mx-auto w-full max-w-6xl px-4 md:px-8"
          style={{
            paddingTop: 24,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 108px)",
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Persistent chrome */}
      <BottomTabBar />
      <AiSidekick />
      <FloatingRecordButton />
      <QuickExitButton />
    </div>
  );
}
