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
    accent: "#4132B4",
    ink: "#1A1224",
    muted: "#6B6A78",
    card: "#FFFFFF",
    line: "rgba(26,18,36,0.12)",
    gradientFrom: "#A38BEB",
    gradientTo: "#196CD4",
    mark: "#F1ECFC",
    displayFont: DISPLAY,
  },
  advocate: {
    accent: "#2F4E34",
    ink: "#17251C",
    muted: "#5D6C62",
    card: "#FFFFFF",
    line: "rgba(23,37,28,0.12)",
    gradientFrom: "#95AD85",
    gradientTo: "#5F8B67",
    mark: "#EDF2EC",
    displayFont: DISPLAY,
  },
  attorney: {
    accent: "#062358",
    ink: "#0E1729",
    muted: "#4C596F",
    card: "#FFFFFF",
    line: "rgba(14,23,41,0.14)",
    gradientFrom: "#296DD8",
    gradientTo: "#164FA8",
    mark: "#E8EEF9",
    displayFont: DISPLAY,
  },
};

export function portalTheme(variant: PortalVariant): PortalTheme {
  return PORTAL_THEME[variant];
}
