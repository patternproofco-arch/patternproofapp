import type React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Make any fixed-positioned element draggable around the viewport.
 * Persists position to localStorage under `storageKey`.
 * Returns ref to attach to the draggable element + the current style.
 */
export function useDraggable(
  storageKey: string,
  initial: { right?: number; bottom?: number; left?: number; top?: number }
) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });
  const ref = useRef<HTMLElement | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
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
      const left = Math.max(4, Math.min(window.innerWidth - w - 4, cx - offset.current.x));
      const top = Math.max(4, Math.min(window.innerHeight - h - 4, cy - offset.current.y));
      const dist = Math.hypot(cx - start.current.x, cy - start.current.y);
      if (dist < DRAG_THRESHOLD && !moved.current) return;
      moved.current = true;
      setPos({ left, top });
    };
    const mm = (e: MouseEvent) => { if (dragging.current) onMove(e.clientX, e.clientY); };
    const tm = (e: TouchEvent) => {
      if (!dragging.current || !e.touches[0]) return;
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const end = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (moved.current) {
        try { window.localStorage.setItem(storageKey, JSON.stringify(pos)); } catch {}
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