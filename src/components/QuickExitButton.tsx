import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings-context";
import { useDraggable } from "@/hooks/use-draggable";
import { quickExit } from "@/lib/quick-exit";

type ExitPos = { right?: number; bottom?: number; left?: number; top?: number };

export function QuickExitButton({
  defaultPosition = { right: 16, top: 70 },
  storageKey = "pp.exit.pos",
}: {
  /** Default dock when the user hasn't dragged the control yet. */
  defaultPosition?: ExitPos;
  /** Separate keys keep public vs signed-in docks from fighting each other. */
  storageKey?: string;
} = {}) {
  const { settings } = useSettings();
  const lastEsc = useRef(0);
  const {
    ref,
    style: dragStyle,
    dragHandlers,
    wasDragged,
  } = useDraggable(storageKey, defaultPosition);

  // Signs the user out for real, then redirects. See src/lib/quick-exit.ts.
  const exit = () => quickExit(settings.exitUrl);

  // Tell the pre-hydration fallback in __root.tsx to stand down — React is
  // driving now, so its own click/Escape handling below takes over (this is
  // what restores drag-to-move and gives up the plain global listener).
  useEffect(() => {
    (window as unknown as { __ppQuickExitHydrated?: boolean }).__ppQuickExitHydrated = true;
  }, []);

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
      onClick={() => {
        if (!wasDragged()) exit();
      }}
      aria-label="Quick exit"
      title="Quick exit — signs you out and leaves. Drag to move, double-press Esc to exit"
      data-quick-exit="true"
      className="no-print fixed z-[9999] inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] font-bold"
      style={{
        background: "#B7D8B0" /* pastel green */,
        color: "#1F3A1B",
        boxShadow: "var(--pp-shadow-sm)",
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
