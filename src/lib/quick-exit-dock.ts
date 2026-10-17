/**
 * Where Quick Exit docks on phones (survivor shell + onboarding).
 *
 * On phones the floating button used to sit at right:16/top:70, i.e. over the
 * content column, so a field scrolled under it (e.g. "Account password" in
 * Settings → AI assistance & connected apps) could not be tapped — and a tap
 * there would trigger Quick Exit instead. Below 640px the page header is sticky
 * and opaque and reserves its top-right slot; Quick Exit docks there in BOTH the
 * shell and onboarding (one corner everywhere), so it never covers form controls
 * while staying on screen and one tap away. Phones in landscape (height < 500) keep it too.
 * PIN screen, /support and /resources use the same dock; the global header
 * there is sticky and reserves the same top-right room. Wider screens keep the
 * original dock.
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

/** Phones held landscape are wider than 640 but short; they keep the header dock. */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;

export function isPhoneViewport(viewportWidth: number | undefined, viewportHeight?: number) {
  if (viewportWidth === undefined) return false;
  return (
    viewportWidth < NARROW_SHELL_MAX_WIDTH ||
    (viewportHeight !== undefined && viewportHeight < PHONE_LANDSCAPE_MAX_HEIGHT)
  );
}

export function quickExitDock(viewportWidth: number | undefined, viewportHeight?: number) {
  return isPhoneViewport(viewportWidth, viewportHeight) ? PHONE_DOCK : WIDE_DOCK;
}

/**
 * On phones a saved drag position is clamped to the header band's top-right
 * dock: one corner everywhere, whatever the button's rendered width (WebKit and
 * Chromium measure the label differently), so a position saved mid-screen can
 * never cover content or drift off the corner. Wider screens keep it as-is.
 */
export function clampSavedQuickExitPosition(
  pos: { left: number; top: number },
  viewport: { width: number; height: number },
  size: { width: number; height: number },
) {
  if (!isPhoneViewport(viewport.width, viewport.height)) return pos;
  return {
    left: Math.max(4, viewport.width - size.width - PHONE_DOCK.right),
    top: Math.min(PHONE_DOCK.top, Math.max(4, PHONE_HEADER_BAND - size.height - 4)),
  };
}
