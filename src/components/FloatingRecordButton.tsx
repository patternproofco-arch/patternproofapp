import type React from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { useRecording } from "@/lib/recording-context";
import { useSettings } from "@/lib/settings-context";
import { toast } from "sonner";
import { useDraggable } from "@/hooks/use-draggable";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function FloatingRecordButton() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { settings, update } = useSettings();
  const { isRecording, elapsed, remaining, nearLimit, start, stop } = useRecording();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPress = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const {
    ref,
    style: dragStyle,
    dragHandlers,
    wasDragged,
  } = useDraggable("pp.mic.pos", { right: 24, bottom: 24 }, { display: keepClearOfChrome });
  // Re-measure the nav and Quick Exit after layout, on resize and on route change.
  const [, setLayoutTick] = useState(0);
  useEffect(() => {
    const bump = () => setLayoutTick((n) => n + 1);
    const raf = window.requestAnimationFrame(bump);
    // The nav and Quick Exit can mount or change height after this button does.
    const ro = new ResizeObserver(bump);
    const watch = () => {
      for (const el of document.querySelectorAll(".pp-bottom-tab-bar, [data-phone-dock]"))
        ro.observe(el);
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    const late = window.setTimeout(bump, 400);
    window.addEventListener("resize", bump);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(late);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, [pathname]);
  const chromeStyle = recorderStyle(dragStyle);

  // Hide on routes where button shouldn't render
  const hideOnRoutes =
    pathname === "/onboarding" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/attorney/");

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-record-menu]") && !t.closest?.("[data-record-btn]"))
        setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("touchstart", close);
    };
  }, [menuOpen]);

  if (hideOnRoutes || !settings.quickRecordVisible) return null;

  const onPointerDown = () => {
    fired.current = false;
    if (isRecording) return;
    longPress.current = window.setTimeout(() => {
      fired.current = true;
      setMenuOpen(true);
    }, 1000);
  };
  const onPointerUp = () => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = undefined;
    }
  };
  const onPointerLeave = onPointerUp;

  const handleClick = async () => {
    if (wasDragged()) return;
    if (fired.current) {
      fired.current = false;
      return;
    }
    if (settings.quickRecordFrozen) return;
    if (isRecording) {
      await stop();
      // already on /live-recording page; it will pick up pending
      if (!pathname.startsWith("/live-recording")) navigate({ to: "/live-recording" });
      return;
    }
    const ok = await start();
    if (!ok) {
      toast("We couldn't access the microphone.");
      return;
    }
    if (!pathname.startsWith("/live-recording")) navigate({ to: "/live-recording" });
  };

  const frozen = settings.quickRecordFrozen;
  const bg = frozen ? "#6B6258" : isRecording ? "#5F7A5E" : "#7A9479";

  return (
    <>
      {/* Elapsed timer above button while recording */}
      {isRecording && (
        <div
          className="no-print fixed z-[95] rounded-full px-3 py-1 text-[12px]"
          style={{
            background: "var(--panel)",
            color: "var(--sidebar-active)",
            right: "24px",
            bottom: "96px",
            fontWeight: 500,
          }}
        >
          {fmt(elapsed)}
          {nearLimit && (
            <span role="status" aria-live="polite" style={{ color: "var(--oxblood)" }}>
              {" "}
              · stops in {remaining}s
            </span>
          )}
        </div>
      )}

      {/* Long-press menu */}
      {menuOpen && (
        <div
          data-record-menu
          className="no-print fixed z-[96] w-[180px] rounded-2xl p-2"
          style={{
            background: "var(--linen)",
            boxShadow: "var(--pp-shadow-sm)",
            right: "24px",
            bottom: "96px",
          }}
        >
          <button
            onClick={() => {
              update({ quickRecordFrozen: !frozen });
              setMenuOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "var(--foreground)" }}
          >
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button
            onClick={() => {
              update({ quickRecordVisible: false });
              setMenuOpen(false);
              toast("Quick record button hidden. Turn it back on in Settings.");
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "var(--foreground)" }}
          >
            Hide
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* The button — anchored bottom-right with soft breathing pulse */}
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        data-record-btn
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        onMouseDown={(e) => {
          dragHandlers.onMouseDown(e);
          onPointerDown();
        }}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerLeave}
        onTouchStart={(e) => {
          dragHandlers.onTouchStart(e);
          onPointerDown();
        }}
        onTouchEnd={onPointerUp}
        onClick={handleClick}
        data-float-record
        className={`no-print fixed z-[94] flex h-14 w-14 items-center justify-center rounded-full ${isRecording ? "pulse-rec" : frozen ? "" : "breathe"}`}
        style={{
          background: bg,
          color: "#F7F3EC",
          ...chromeStyle,
          boxShadow: "var(--pp-shadow-sm)",
          touchAction: "none",
          cursor: "grab",
        }}
      >
        {/* Recording dot icon */}
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: isRecording ? "var(--paper)" : "var(--oxblood)",
            display: "inline-block",
          }}
        />
        {frozen && (
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--panel)", color: "var(--sidebar-active)" }}
          >
            <Lock size={11} />
          </span>
        )}
      </button>
    </>
  );
}

const REC_SIZE = 56;
const REC_GAP = 12;

/**
 * The recorder never sits on the bottom nav (which already includes the
 * safe-area inset) or on Quick Exit: it is kept above the nav's top edge and
 * below the Quick Exit dock when they would share the same column.
 */
export function keepClearOfChrome(pos: { left: number; top: number }) {
  if (typeof window === "undefined") return pos;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nav = document.querySelector(".pp-bottom-tab-bar")?.getBoundingClientRect();
  const qe = document.querySelector("[data-phone-dock]")?.getBoundingClientRect();
  const floor = (nav && nav.height > 0 ? nav.top : vh) - REC_GAP - REC_SIZE;
  const left = Math.max(4, Math.min(vw - REC_SIZE - 4, pos.left));
  let top = Math.min(floor, Math.max(4, pos.top));
  if (qe && qe.height > 0 && left < qe.right && left + REC_SIZE > qe.left) {
    top = Math.max(top, Math.min(floor, qe.bottom + REC_GAP));
  }
  return { left, top };
}

function recorderStyle(style: React.CSSProperties): React.CSSProperties {
  if (typeof window === "undefined") return style;
  if (typeof style.left === "number" && typeof style.top === "number") return style;
  // Default spot: bottom-right, above the nav.
  return {
    ...keepClearOfChrome({
      left: window.innerWidth - 24 - REC_SIZE,
      top: window.innerHeight,
    }),
    right: "auto",
    bottom: "auto",
  };
}
