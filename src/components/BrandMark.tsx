import { portalTheme } from "@/components/shared/portal-theme";
import type { PortalVariant } from "@/components/shared/portal-theme";

export const OXBLOOD = "#8C1FFC";
export const OXBLOOD_DEEP = "#6A16C2";
export const PURPLE = "#3E19F8";
export const PURPLE_MID = "#3113C0";
export const RED_BRIGHT = "#D46FFD";
export const LAV = "#B98BFF";
export const INK = "#1A1224";
export const PAPER = "#FAF8F4";
export const DISPLAY = "'Fraunces', Georgia, serif";
export const UI = "'Space Grotesk', system-ui, sans-serif";

export type MarkVariant = PortalVariant | "neutral";

/**
 * ONE canonical cube geometry, defined once and shared by every variant and
 * every call site. Never duplicate or re-derive these points per variant —
 * that is how per-audience icon sets drift out of alignment.
 */
export const CUBE_VIEWBOX = "0 0 200 200";
const T = "100,28";
const L = "38,64";
const R = "162,64";
const C = "100,100";
const BL = "38,136";
const BR = "162,136";
const B = "100,172";
export const CUBE_FACETS = {
  top: `${T} ${R} ${C} ${L}`,
  right: `${C} ${R} ${BR} ${B}`,
  left: `${L} ${C} ${B} ${BL}`,
} as const;

/**
 * Facet colors are derived from the single source of portal color
 * (`portalTheme`) — the mark cannot drift out of sync with the UI.
 * top = gradientFrom, right = gradientTo, left/shadow = the theme's deep accent.
 */
export function cubeFacets(variant: MarkVariant = "neutral") {
  const theme = portalTheme(variant === "neutral" ? "survivor" : variant);
  return { top: theme.gradientFrom, right: theme.gradientTo, left: theme.accent };
}

interface BrandMarkProps {
  /** Rendered height in px. */
  size?: number;
  /** Portal audience. "neutral" (default) renders the survivor cube. */
  variant?: MarkVariant;
  /** Dark surface — seams switch to the page ink instead of paper. */
  onDark?: boolean;
  className?: string;
}

/**
 * The PatternProof mark: an isometric cube — the same record seen from three
 * faces at once. One geometry, three portal colorways.
 */
export function BrandMark({ size = 40, variant = "neutral", onDark = false, className }: BrandMarkProps) {
  const f = cubeFacets(variant);
  const seam = onDark ? INK : PAPER;
  return (
    <svg
      viewBox={CUBE_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block", overflow: "hidden" }}
    >
      <g stroke={seam} strokeWidth={3} strokeLinejoin="round">
        <polygon points={CUBE_FACETS.left} fill={f.left} />
        <polygon points={CUBE_FACETS.right} fill={f.right} />
        <polygon points={CUBE_FACETS.top} fill={f.top} />
      </g>
    </svg>
  );
}

export default BrandMark;
