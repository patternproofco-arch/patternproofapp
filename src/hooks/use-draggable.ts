import type React from "react";
import { useEffect, useRef, useState } from "react";

/** The part of the page the person can actually see (visual viewport when available). */
function visibleViewport(): { width: number; height: number } {
  const vv = window.visualViewport;
  const width = Math.min(window.innerWidth, vv?.width ?? window.innerWidth);
  const height = Math.min(window.innerHeight, vv?.height ?? window.innerHeight);
  return { width, height };
}

/**
 * Make any fixed-positioned element draggable around the viewport.
 * Persists position to localStorage under `storageKey`.
 * Returns ref to attach to the draggable element + the current style.
 */
export function useDraggable(
  storageKey: string,
  initial: { right?: number; bottom?: number; left?: number; top?: number },
) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {
      // Invalid or unavailable local storage falls back to the default position.
    }
    return null;
  });
  const ref = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  // Keep a remembered position on screen. A spot saved on a wider screen (tablet, rotated phone)
  // must not park a safety control off the edge of a 320px phone.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clamp = () => {
      const el = ref.current;
      if (!el) return;
      setPos((p) => {
        if (!p) return p;
        const rect = el.getBoundingClientRect();
        const { width: vw, height: vh } = visibleViewport();
        const left = Math.max(4, Math.min(vw - rect.width - 4, p.left));
        const top = Math.max(4, Math.min(vh - rect.height - 4, p.top));
        return left === p.left && top === p.top ? p : { left, top };
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    window.visualViewport?.addEventListener("resize", clamp);
    return () => {
      window.removeEventListener("resize", clamp);
      window.visualViewport?.removeEventListener("resize", clamp);
    };
  }, []);

  /** Below this many px of travel we treat the gesture as a tap, not a drag —
   *  otherwise a shaky finger swallows the click on a safety-critical button. */
  const DRAG_THRESHOLD = 6;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const { width: vw, height: vh } = visibleViewport();
      const left = Math.max(4, Math.min(vw - w - 4, cx - offset.current.x));
      const top = Math.max(4, Math.min(vh - h - 4, cy - offset.current.y));
      const dist = Math.hypot(cx - start.current.x, cy - start.current.y);
      if (dist < DRAG_THRESHOLD && !moved.current) return;
      moved.current = true;
      setPos({ left, top });
    };
    const mm = (e: MouseEvent) => {
      if (dragging.current) onMove(e.clientX, e.clientY);
    };
    const tm = (e: TouchEvent) => {
      if (!dragging.current || !e.touches[0]) return;
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const end = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (moved.current) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(pos));
        } catch {
          // Dragging remains usable when local storage is unavailable.
        }
      }
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", end);
    };
  }, [pos, storageKey]);

  const startDrag = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    offset.current = { x: clientX - rect.left, y: clientY - rect.top };
    start.current = { x: clientX, y: clientY };
    moved.current = false;
    dragging.current = true;
  };

  const dragHandlers = {
    onMouseDown: (e: React.MouseEvent) => startDrag(e.clientX, e.clientY),
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (t) startDrag(t.clientX, t.clientY);
    },
  };

  const style: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : { ...initial };

  return { ref, style, dragHandlers, wasDragged: () => moved.current };
}
