/**
 * Where Quick Exit docks on phones (survivor shell + onboarding).
 *
 * On phones the floating button used to sit at right:16/top:70, i.e. over the
 * content column, so a field scrolled under it (e.g. "Account password" in
 * Settings → AI assistance & connected apps) could not be tapped — and a tap
 * there would trigger Quick Exit instead. Below 640px the page header is sticky
 * and opaque and reserves its top-right slot; Quick Exit docks there in BOTH the
 * shell and onboarding (one corner everywhere), so it never covers form controls
 * while staying on screen and one tap away. Wider screens keep the original dock.
 *
 * The dock is computed after mount (never during render) and recomputed on
 * resize / orientation change — see QuickExitButton. Before mount, the CSS class
 * `.pp-qe-dock` (styles.css) places it with a media query so first paint is right.
 */
export const NARROW_SHELL_MAX_WIDTH = 640;
/** Height of the sticky header band on phones (styles.css keeps these in sync). */
export const PHONE_HEADER_BAND = 60;
/** Width of the top-right header slot reserved for Quick Exit on phones. */
export const PHONE_RESERVED_SLOT = 132;
export const PHONE_DOCK = { right: 16, top: 8 } as const;
export const WIDE_DOCK = { right: 16, top: 70 } as const;
/** Bumped by #236: positions saved before it are discarded once. */
export const QUICK_EXIT_DOCK_VERSION = "236";
export const QUICK_EXIT_DOCK_VERSION_KEY = "pp.exit.dock.v";

export function isPhoneWidth(viewportWidth: number | undefined) {
  return viewportWidth !== undefined && viewportWidth < NARROW_SHELL_MAX_WIDTH;
}

export function quickExitDock(viewportWidth: number | undefined) {
  return isPhoneWidth(viewportWidth) ? PHONE_DOCK : WIDE_DOCK;
}

/**
 * Below 640px a saved drag position is clamped into the header band's reserved
 * top-right slot, so a position saved mid-screen can never cover content.
 * Wider screens keep the saved position as-is.
 */
export function clampSavedQuickExitPosition(
  pos: { left: number; top: number },
  viewport: { width: number; height: number },
  size: { width: number; height: number },
) {
  if (!isPhoneWidth(viewport.width)) return pos;
  const minLeft = Math.max(4, viewport.width - PHONE_RESERVED_SLOT);
  const maxLeft = Math.max(minLeft, viewport.width - size.width - 4);
  const maxTop = Math.max(4, PHONE_HEADER_BAND - size.height - 4);
  return {
    left: Math.min(maxLeft, Math.max(minLeft, pos.left)),
    top: Math.min(maxTop, Math.max(4, pos.top)),
  };
}
