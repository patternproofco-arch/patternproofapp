import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { GuideHelper } from "@/components/survivor/GuideHelper";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AmbientBackground } from "@/components/AmbientBackground";
import { BottomTabBar } from "@/components/BottomTabBar";
import { HeaderTools } from "@/components/survivor/HeaderTools";
import { SectionSegments } from "@/components/survivor/SectionSegments";
import { NotificationBanner } from "@/components/NotificationBanner";
import { NewConnectionNotice } from "@/components/NewConnectionNotice";
import { quickExit } from "@/lib/quick-exit";
import { FocusModeProvider } from "@/components/survivor/focus-mode";
import "@/styles-role-accents.css";
import "@/styles-survivor-poster.css";

/** Top band colour per section (poster tokens). Home paints its own band. */
function sectionFor(path: string): string | undefined {
  if (path.startsWith("/journal")) return "notes";
  if (path.startsWith("/timeline")) return "timeline";
  if (path.startsWith("/access")) return "sharing";
  return undefined;
}

export function AppShell() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

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
      data-pp-paper=""
      style={{ background: "var(--paper)" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AmbientBackground />

      {/* Mark, Help, Settings; Quick Exit docks in the reserved top-right zone.
          Search, Agent and Support moved to Home's "Show everything"; Sign out to Settings. */}
      <header className="pp-shell-header pp-app-chrome no-print app-surface mx-auto flex w-full max-w-[430px] items-center gap-2">
        <Link to="/dashboard" className="pp2-wordmark" aria-label="PatternProof, Home">
          <span aria-hidden>P</span>
          <span aria-hidden className="pp2-wordmark-rest">
            atternProof
          </span>
        </Link>
        <HeaderTools />
        <span aria-hidden className="pp-qe-slot" />
      </header>

      <NotificationBanner />
      <NewConnectionNotice />

      <FocusModeProvider>
        <main
          id="main-content"
          tabIndex={-1}
          data-section={sectionFor(pathname)}
          className="pp-app-main app-surface print-page mx-auto w-full max-w-[430px] px-4"
          style={{
            paddingTop: 20,
            // Room for the fixed nav, so it never covers the last content.
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
          }}
        >
          <SectionSegments />
          <Outlet />
        </main>
      </FocusModeProvider>

      <BottomTabBar />
      <GuideHelper />
      <QuickExitButton phoneDock />
    </div>
  );
}
