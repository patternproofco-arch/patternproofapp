import { useEffect } from "react";

/**
 * Publishes `--pp-kb-inset` on <html>: how much of the bottom of the layout viewport is covered by
 * the on-screen keyboard (from visualViewport). Sticky save actions use it; when the inset is
 * non-zero we also set `data-pp-kb="1"` so CSS can switch the bar to `position: fixed` (sticky
 * cannot sit above a keyboard that still covers the layout viewport on iOS).
 */
export function useViewportInsets(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => {
      const covered = vv ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : 0;
      // Small deltas are browser chrome collapsing, not a keyboard.
      const kb = covered > 80 ? covered : 0;
      root.style.setProperty("--pp-kb-inset", `${kb}px`);
      if (kb > 0) root.setAttribute("data-pp-kb", "1");
      else root.removeAttribute("data-pp-kb");
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--pp-kb-inset");
      root.removeAttribute("data-pp-kb");
    };
  }, []);
}
