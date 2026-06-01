import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { AiSidekick } from "@/components/AiSidekick";
import { FloatingRecordButton } from "@/components/FloatingRecordButton";
import { QuickExitButton } from "@/components/QuickExitButton";
import { AmbientBackground } from "@/components/AmbientBackground";
import { FloatingNav } from "@/components/FloatingNav";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * AppShell — Living Canvas edition.
 * Drops the sidebar/top bar in favour of a floating nav island (mobile)
 * and side dock (desktop), layered above a pastel ambient background.
 */
export function AppShell() {
  const { settings } = useSettings();

  // Quick-exit shortcut: double-Esc
  useEffect(() => {
    let last = 0;
    const exit = () => {
      const url = settings.exitUrl || "https://weather.com";
      try { window.history.replaceState(null, "", "/"); } catch { /* ignore */ }
      window.location.replace(url);
    };
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
    <div className="min-h-screen w-full" style={{ background: "var(--background)" }}>
      {/* Ambient pastel canvas behind everything */}
      <AmbientBackground />

      {/* Minimal logo strip (no chrome bar) — sits in normal flow */}
      <header
        className="no-print app-surface mx-auto flex w-full max-w-6xl items-center justify-center px-5 pt-5 md:px-10 md:pt-6"
      >
        <BrandLogo variant="dark" size="sm" />
      </header>

      <main
        className="app-surface print-page mx-auto w-full max-w-6xl px-5 md:px-10"
        style={{
          paddingTop: 24,
          // bottom padding: nav island height + safety
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 120px)",
        }}
      >
        <Outlet />
      </main>

      {/* Floating chrome */}
      <FloatingNav />
      <AiSidekick />
      <FloatingRecordButton />
      <QuickExitButton />
    </div>
  );
}