import type { ReactNode } from "react";
import { usePrepQuietTab } from "@/hooks/use-prep-quiet-tab";
import { usePrepSessionGuards } from "@/hooks/use-prep-session-guards";

/**
 * Quiet Tab toggle + visibility pause overlay + inactivity purge wiring for /prep/*.
 */
export function PrepSessionChrome({ children }: { children: ReactNode }) {
  const { enabled, toggle, quietTitle } = usePrepQuietTab();
  const { paused, resume, pauseText } = usePrepSessionGuards(true);

  return (
    <div className="relative">
      <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2" style={{ color: "var(--pp-ink)" }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
          />
          Quiet Tab (show “{quietTitle}” in the tab)
        </label>
      </div>
      {children}
      {paused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={pauseText}
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          style={{
            background: "rgba(250, 248, 242, 0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
          onClick={resume}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") resume();
          }}
          tabIndex={0}
        >
          <p
            className="max-w-sm text-center text-base leading-relaxed"
            style={{ color: "var(--pp-ink)", fontFamily: "var(--font-serif)" }}
          >
            {pauseText}
          </p>
        </div>
      )}
    </div>
  );
}
