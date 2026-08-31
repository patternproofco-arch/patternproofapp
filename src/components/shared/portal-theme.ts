/** Shared visual language for the three portal dashboards.
 *
 *  Colors, shadows, and fonts here are read live from the CSS custom
 *  properties each portal's layout route already sets via
 *  `[data-persona="survivor"|"org"|"attorney"]` (src/styles.css) — that
 *  file is the single source of truth. This module used to duplicate
 *  those values as hardcoded hex, which let the two drift apart; now it
 *  just names the right `var(--pp-*)` for each field, so a color change
 *  in styles.css can't silently split into two answers again. The one
 *  thing that isn't part of that token system yet is the per-portal
 *  gradient used by the dashboard hero card, so that stays defined here.
 *
 *  Neumorphic system: every surface starts from the same tinted "ground"
 *  colour and is carved or extruded with paired light/dark shadows —
 *  never a border. `ground`/`groundHi` are the two ground tints a
 *  resting and raised surface each read against; `line` is a hairline
 *  rule color, used for borders/dividers, not the shadow itself. */
export type PortalVariant = "survivor" | "advocate" | "attorney";

export interface PortalTheme {
  accent: string;
  link: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  ground: string;
  groundHi: string;
  gradientFrom: string;
  gradientMid?: string;
  gradientTo: string;
  mark: string;
  displayFont: string;
  bodyFont: string;
}

const SHARED_TOKENS = {
  accent: "var(--pp-accent)",
  link: "var(--pp-link, var(--pp-accent))",
  ink: "var(--pp-ink)",
  muted: "var(--pp-muted)",
  card: "var(--pp-card)",
  line: "var(--pp-hairline)",
  ground: "var(--pp-ground)",
  groundHi: "var(--pp-ground-hi)",
  mark: "var(--pp-ground-hi)",
  displayFont: "var(--font-serif)",
  bodyFont: "var(--font-sans)",
} as const;

// Every stop is derived from the persona's single LOCKED accent token via
// color-mix() — same technique as --pp-thread-grad in styles.css — so this
// gradient can never drift into a competing, unlocked hue.
const GRADIENTS: Record<PortalVariant, { from: string; mid?: string; to: string }> = {
  survivor: {
    from: "color-mix(in srgb, var(--pp-accent-survivor) 55%, white)",
    mid: "var(--pp-accent-survivor)",
    to: "color-mix(in srgb, var(--pp-accent-survivor) 70%, black)",
  },
  advocate: {
    from: "color-mix(in srgb, var(--pp-accent-org) 55%, white)",
    to: "color-mix(in srgb, var(--pp-accent-org) 70%, black)",
  },
  attorney: {
    from: "color-mix(in srgb, var(--pp-accent-attorney) 55%, white)",
    to: "color-mix(in srgb, var(--pp-accent-attorney) 70%, black)",
  },
};

export const PORTAL_THEME: Record<PortalVariant, PortalTheme> = {
  survivor: {
    ...SHARED_TOKENS,
    gradientFrom: GRADIENTS.survivor.from,
    gradientMid: GRADIENTS.survivor.mid,
    gradientTo: GRADIENTS.survivor.to,
  },
  advocate: {
    ...SHARED_TOKENS,
    gradientFrom: GRADIENTS.advocate.from,
    gradientTo: GRADIENTS.advocate.to,
  },
  attorney: {
    ...SHARED_TOKENS,
    gradientFrom: GRADIENTS.attorney.from,
    gradientTo: GRADIENTS.attorney.to,
  },
};

export function portalTheme(variant: PortalVariant): PortalTheme {
  return PORTAL_THEME[variant];
}

/** Paired-shadow elevation. Reads the ambient CSS custom properties set by
 *  the surrounding `[data-persona]` wrapper, so it no longer needs a ground
 *  argument or a hardcoded ground→shadow lookup table — that table only
 *  covered three exact hex values and had already drifted from
 *  src/styles.css. `up*` = raised/extruded, `in*` = carved/inset. */
export function neuShadow() {
  return {
    up: "var(--pp-shadow-up)",
    upSm: "var(--pp-shadow-sm)",
    upXs: "var(--pp-shadow-xs)",
    upLg: "var(--pp-shadow-lg)",
    in: "var(--pp-shadow-in)",
    inSm: "var(--pp-shadow-in-sm)",
  };
}
