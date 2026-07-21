import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings-context";
import { useDraggable } from "@/hooks/use-draggable";

export function QuickExitButton() {
  const { settings } = useSettings();
  const lastEsc = useRef(0);
  const { ref, style: dragStyle, dragHandlers, wasDragged } = useDraggable(
    "pp.exit.pos",
    { right: 16, top: 70 }
  );

  const exit = () => {
    const url = settings.exitUrl || "https://weather.com";
    // Best-effort cleanup: clear session-unlock state and neutralize the tab
    // title before navigating away. We do NOT and cannot clear browser history,
    // downloads, notifications, or artifacts outside this document.
    try {
      window.sessionStorage.removeItem("pp.pinUnlocked");
      window.sessionStorage.removeItem("pp.session.unlocked");
      // Clear any transient PP session state.
      Object.keys(window.sessionStorage).forEach((k) => {
        if (k.startsWith("pp.")) window.sessionStorage.removeItem(k);
      });
    } catch { /* ignore */ }
    try { document.title = "Weather"; } catch { /* ignore */ }
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* ignore */
    }
    // Full-page navigation, not SPA.
    window.location.href = url;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const now = Date.now();
        if (now - lastEsc.current < 500) exit();
        lastEsc.current = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.exitUrl]);

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onMouseDown={dragHandlers.onMouseDown}
      onTouchStart={dragHandlers.onTouchStart}
      onClick={() => { if (!wasDragged()) exit(); }}
      aria-label="Quick exit"
      title="Quick exit — drag to move, double-press Esc to exit"
      className="no-print fixed z-[9999] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
      style={{
        background: "#B7D8B0", /* pastel green */
        color: "#1F3A1B",
        boxShadow: "0 4px 14px rgba(31,26,20,0.18)",
        letterSpacing: "0.04em",
        touchAction: "none",
        cursor: "grab",
        ...dragStyle,
      }}
    >
      <span>Exit safely</span>
      <ArrowUpRight size={14} strokeWidth={2.5} />
    </button>
  );
}