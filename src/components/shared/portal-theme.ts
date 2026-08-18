/** Shared visual language for the three portal dashboards.
 *  One shell, three themes. Colors live here and nowhere else. */
export type PortalVariant = "survivor" | "advocate" | "attorney";

export interface PortalTheme {
  accent: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  gradientFrom: string;
  gradientTo: string;
  mark: string;
  displayFont: string;
}

const DISPLAY = "'Fraunces', Georgia, serif";

export const PORTAL_THEME: Record<PortalVariant, PortalTheme> = {
  survivor: {
    accent: "#4A2A6B",
    ink: "#1A1224",
    muted: "#6B6A78",
    card: "#FFFFFF",
    line: "rgba(26,18,36,0.12)",
    gradientFrom: "#4A2A6B",
    gradientTo: "#7A4FA8",
    mark: "#EFE9F7",
    displayFont: DISPLAY,
  },
  advocate: {
    accent: "#2E4A38",
    ink: "#17251C",
    muted: "#5D6C62",
    card: "#FFFFFF",
    line: "rgba(23,37,28,0.12)",
    gradientFrom: "#2E4A38",
    gradientTo: "#5C8A6B",
    mark: "#E7F0E9",
    displayFont: DISPLAY,
  },
  attorney: {
    accent: "#22314F",
    ink: "#0E1729",
    muted: "#4C596F",
    card: "#FFFFFF",
    line: "rgba(14,23,41,0.14)",
    gradientFrom: "#0E1729",
    gradientTo: "#3C5480",
    mark: "#E6EAF2",
    displayFont: DISPLAY,
  },
};

export function portalTheme(variant: PortalVariant): PortalTheme {
  return PORTAL_THEME[variant];
}
