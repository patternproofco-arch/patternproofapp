/**
 * Where the survivor shell docks Quick Exit by default.
 *
 * On phones the floating button used to sit at right:16/top:70, i.e. over the
 * content column, so a field scrolled under it (e.g. "Account password" in
 * Settings → AI assistance & connected apps) could not be tapped — and a tap
 * there would trigger Quick Exit instead. On narrow screens the shell header is
 * sticky and opaque (styles.css, .pp-app-shell .pp-shell-header), and Quick Exit
 * docks in that header's empty left slot, so it never covers form controls while
 * staying on screen and one tap away. Wider screens keep the original dock.
 */
export const NARROW_SHELL_MAX_WIDTH = 640;

export function shellQuickExitDock(viewportWidth: number | undefined) {
  if (viewportWidth !== undefined && viewportWidth < NARROW_SHELL_MAX_WIDTH)
    return { left: 16, top: 13 } as const;
  return { right: 16, top: 70 } as const;
}

/** Onboarding: brand on the left, so on phones Quick Exit docks top-right inside
 * that page's sticky header row (same reasoning as the shell). */
export function onboardingQuickExitDock(viewportWidth: number | undefined) {
  if (viewportWidth !== undefined && viewportWidth < NARROW_SHELL_MAX_WIDTH)
    return { right: 20, top: 14 } as const;
  return { right: 16, top: 70 } as const;
}
