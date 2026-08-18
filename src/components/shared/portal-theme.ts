import { PpCubeMark } from "@/components/survivor/PpCubeMark";
import { OrgCubeMark } from "@/components/org/OrgCubeMark";
import type { ComponentType } from "react";

export type PortalVariant = "survivor" | "advocate" | "attorney";

export interface PortalTheme {
  /** Accent sampled from the portal's existing brand mark / token set. */
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  card: string;
  line: string;
  gradientFrom: string;
  gradientTo: string;
  label: string;
  mark: ComponentType<{ size?: number; className?: string }> | null;
  /** Display face used for the wordmark, greetings and hero numerals. */
  displayFont: string;
}

/**
 * Accent values are sampled from the marks and token files already in use:
 * survivor `--sv-purple-700`, advocate `--ox-sage-deep`, attorney `--att-navy`.
 * No new brand colours are invented here.
 */
export const PORTAL_THEME: Record<PortalVariant, PortalTheme> = {
  survivor: {
    accent: "#4A2A6B",
    accentSoft: "rgba(74,42,107,0.08)",
    ink: "#1F1A2B",
    muted: "#6E6683",
    card: "#FFFFFF",
    line: "#E7E2F0",
    gradientFrom: "#F5F1FB",
    gradientTo: "#EDE7F6",
    label: "SURVIVOR PORTAL",
    mark: PpCubeMark,
    displayFont: "'Fraunces', Georgia, serif",
  },
  advocate: {
    accent: "#4C7359",
    accentSoft: "rgba(76,115,89,0.09)",
    ink: "#1F2B24",
    muted: "#6B7A70",
    card: "#FFFFFF",
    line: "#E8EDE8",
    gradientFrom: "#F3F8F4",
    gradientTo: "#E6F0E8",
    label: "DV ORGANIZATION PORTAL",
    mark: OrgCubeMark as ComponentType<{ size?: number; className?: string }>,
    displayFont: "'Fraunces', Georgia, serif",
  },
  attorney: {
    accent: "#2A2C95",
    accentSoft: "rgba(42,44,149,0.08)",
    ink: "#0B0D2A",
    muted: "#6B6F95",
    card: "#FFFFFF",
    line: "rgba(31,33,101,0.16)",
    gradientFrom: "#F2F2FB",
    gradientTo: "#E6E7F7",
    label: "LAWYER PORTAL",
    mark: null,
    displayFont: "'Instrument Serif', 'Fraunces', Georgia, serif",
  },
};
