/** Shared visual language for the three portal dashboards.
 *  One shell, three themes. Colors live here and nowhere else.
 *
 *  Neumorphic system: every surface starts from the same tinted "ground"
 *  colour and is carved or extruded with paired light/dark shadows —
 *  never a border. `line` here is the shadow's dark half, not a border
 *  colour; `ground`/`groundHi`/`groundLo` are the three ground tints a
 *  raised, resting, and carved (inset) surface each read against. */
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
  groundLo: string;
  gradientFrom: string;
  gradientMid?: string;
  gradientTo: string;
  mark: string;
  displayFont: string;
  bodyFont: string;
}

const INK = "#232A38";
const MUTED = "#626C80";

export const PORTAL_THEME: Record<PortalVariant, PortalTheme> = {
  survivor: {
    accent: "#7B5CE0",
    link: "#2BA8C6",
    ink: INK,
    muted: MUTED,
    card: "#FFFFFF",
    line: "#CCC4D6",
    ground: "#F0EBF4",
    groundHi: "#F5F1F8",
    groundLo: "#E9E3EF",
    gradientFrom: "#E879F9",
    gradientMid: "#8B5CF6",
    gradientTo: "#38D9F0",
    mark: "#F5F1F8",
    displayFont: "'Source Serif 4', Georgia, serif",
    bodyFont: "'Figtree', system-ui, sans-serif",
  },
  advocate: {
    accent: "#4A5C43",
    link: "#5D7A52",
    ink: INK,
    muted: MUTED,
    card: "#FFFFFF",
    line: "#C6CEC1",
    ground: "#ECEFE9",
    groundHi: "#F1F4EE",
    groundLo: "#E5E9E2",
    gradientFrom: "#8FA383",
    gradientTo: "#4A5C43",
    mark: "#F1F4EE",
    displayFont: "'Newsreader', Georgia, serif",
    bodyFont: "'Public Sans', system-ui, sans-serif",
  },
  attorney: {
    accent: "#1B2A6B",
    link: "#3F6DF0",
    ink: INK,
    muted: MUTED,
    card: "#FFFFFF",
    line: "#C0C8DD",
    ground: "#E8EBF4",
    groundHi: "#EEF1F8",
    groundLo: "#E0E4F0",
    gradientFrom: "#3F6DF0",
    gradientTo: "#1B2A6B",
    mark: "#EEF1F8",
    displayFont: "'Newsreader', Georgia, serif",
    bodyFont: "'Public Sans', system-ui, sans-serif",
  },
};

export function portalTheme(variant: PortalVariant): PortalTheme {
  return PORTAL_THEME[variant];
}

/** Paired-shadow elevation, computed against a given ground colour.
 *  `up*` = raised/extruded, `in*` = carved/inset. */
export function neuShadow(ground: string) {
  const dark = shadowDarkFor(ground);
  return {
    up: `-6px -6px 13px #ffffff, 6px 6px 13px ${dark}`,
    upSm: `-3px -3px 7px #ffffff, 3px 3px 7px ${dark}`,
    upXs: `-2px -2px 4px #ffffff, 2px 2px 4px ${dark}`,
    upLg: `-9px -9px 20px #ffffff, 9px 9px 20px ${dark}`,
    in: `inset -4px -4px 8px #ffffff, inset 4px 4px 8px ${dark}`,
    inSm: `inset -2px -2px 4px #ffffff, inset 2px 2px 5px ${dark}`,
  };
}

function shadowDarkFor(ground: string): string {
  const known: Record<string, string> = {
    "#F0EBF4": "#CCC4D6",
    "#ECEFE9": "#C6CEC1",
    "#E8EBF4": "#C0C8DD",
  };
  return known[ground.toUpperCase()] ?? "#C3CAD8";
}
