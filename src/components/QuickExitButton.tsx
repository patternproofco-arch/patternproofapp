import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings-context";
import { useDraggable } from "@/hooks/use-draggable";
import { quickExit } from "@/lib/quick-exit";
import {
  QUICK_EXIT_DOCK_VERSION,
  QUICK_EXIT_DOCK_VERSION_KEY,
  clampSavedQuickExitPosition,
  quickExitDock,
} from "@/lib/quick-exit-dock";

type ExitPos = { right?: number; bottom?: number; left?: number; top?: number };

export function QuickExitButton({
  defaultPosition = { right: 16, top: 70 },
  storageKey = "pp.exit.pos",
  phoneDock = false,
}: {
  /** Default dock when the user hasn't dragged the control yet. */
  defaultPosition?: ExitPos;
  /** Separate keys keep public vs signed-in docks from fighting each other. */
  storageKey?: string;
  /** Survivor shell + onboarding: dock in the sticky header's top-right slot
   *  below 640px (src/lib/quick-exit-dock.ts). Overrides defaultPosition. */
  phoneDock?: boolean;
} = {}) {
  const { settings } = useSettings();
  const lastEsc = useRef(0);
  // Viewport is read after mount and on resize/orientation change — never during
  // render — so SSR and hydration agree and the dock follows a rotation.
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const [size, setSize] = useState({ width: 120, height: 44 });
  const {
    ref,
    style: dragStyle,
    dragHandlers,
    wasDragged,
    setPos,
  } = useDraggable(storageKey, phoneDock ? quickExitDock(viewport?.width, viewport?.height) : defaultPosition, {
    display: (pos) =>
      phoneDock && viewport ? clampSavedQuickExitPosition(pos, viewport, size) : pos,
  });

  useEffect(() => {
    if (!phoneDock) return;
    // One-time reset of drag positions saved before #236 (they could sit mid-screen).
    try {
      if (window.localStorage.getItem(QUICK_EXIT_DOCK_VERSION_KEY) !== QUICK_EXIT_DOCK_VERSION) {
        window.localStorage.removeItem(storageKey);
        window.localStorage.setItem(QUICK_EXIT_DOCK_VERSION_KEY, QUICK_EXIT_DOCK_VERSION);
        setPos(null);
      }
    } catch {
      // Storage unavailable: clamping below still keeps it in the header band.
    }
    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const r = ref.current?.getBoundingClientRect();
      if (r && r.width > 0) setSize({ width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneDock, storageKey]);

  // Before mount (SSR/first paint) a phone-docked button is placed by the
  // media-query class `.pp-qe-dock` instead of inline coordinates.
  const positionStyle = phoneDock && !viewport ? {} : dragStyle;

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
      data-phone-dock={phoneDock ? "true" : undefined}
      className={`no-print fixed z-[9999] inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] font-bold${phoneDock ? " pp-qe-dock" : ""}`}
      style={{
        background: "#B7D8B0" /* pastel green */,
        color: "#1F3A1B",
        boxShadow: "var(--pp-shadow-sm)",
        letterSpacing: "0.04em",
        touchAction: "none",
        cursor: "grab",
        ...positionStyle,
      }}
    >
      <span>Quick exit</span>
      <ArrowUpRight size={14} strokeWidth={2.5} />
    </button>
  );
}
