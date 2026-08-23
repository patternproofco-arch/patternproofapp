import { useId } from "react";

export const INK = "#232A38";
export const PAPER = "#FAF8F4";
export const DISPLAY = "var(--font-serif)";
export const UI = "var(--font-sans)";

export type MarkVariant = "survivor" | "attorney" | "advocate" | "neutral";

/**
 * ONE canonical mark geometry — a folded "P" ribbon — defined once and
 * shared by every variant and every call site. Never duplicate or
 * re-derive this path per variant; that is how per-audience icon sets
 * drift out of alignment.
 */
export const MARK_VIEWBOX = "0 0 200 200";
export const MARK_PATH =
  "M144.27,147.24C143.27,140.73 143.88,82.82 143.70,75.10C143.52,67.39 143.01,71.15 142.45,70.10C141.89,69.06 142.33,67.47 138.12,64.64C133.92,61.80 107.84,41.77 100.42,41.72C92.99,41.67 68.01,61.37 63.85,64.11C59.70,66.86 59.58,68.14 58.91,69.17C58.23,70.19 57.31,66.58 57.14,74.38C56.96,82.17 57.95,140.31 57.14,147.08C56.32,153.86 50.18,143.17 48.96,142.14C47.74,141.10 45.52,137.88 44.95,136.77C44.38,135.66 43.45,137.73 43.28,131.04C43.11,124.35 43.12,76.61 43.28,69.90C43.44,63.18 44.31,65.03 44.84,63.85C45.38,62.68 43.70,61.60 48.59,58.12C53.48,54.65 88.74,32.20 93.75,29.11C98.76,26.03 97.47,27.30 98.65,27.24C99.82,27.18 100.33,25.58 105.52,28.49C110.71,31.40 145.61,53.03 150.52,56.30C155.43,59.58 153.94,59.87 154.64,61.25C155.33,62.63 157.17,63.11 157.45,70.10C157.73,77.09 157.82,124.14 157.45,131.15C157.07,138.16 155.02,138.60 153.70,140.21C152.38,141.82 145.27,153.75 144.27,147.24Z M81.98,162.76C80.67,169.73 70.20,162.82 68.91,154.38C67.61,145.93 68.66,86.51 69.01,78.33C69.36,70.16 69.59,74.84 72.40,72.66C75.20,70.47 94.14,58.19 97.08,56.51C100.03,54.83 98.53,54.06 101.88,55.89C105.22,57.71 127.58,72.54 130.57,74.79C133.57,77.05 131.71,75.38 131.82,78.44C131.94,81.50 132.11,102.14 131.72,105.42C131.33,108.69 131.82,108.35 127.92,111.20C124.02,114.05 96.23,132.94 92.71,133.91C89.18,134.87 92.55,122.43 92.66,120.83C92.77,119.23 91.24,119.95 93.80,117.92C96.36,115.89 115.80,103.92 118.28,100.52C120.76,97.13 118.76,85.91 118.59,83.96C118.43,82.01 118.43,82.26 116.67,80.99C114.90,79.72 102.76,72.22 100.94,71.30C99.11,70.39 100.21,70.76 98.44,71.82C96.66,72.89 84.82,80.69 83.18,81.98C81.54,83.27 82.15,76.61 82.03,84.69C81.91,92.77 83.29,155.79 81.98,162.76Z";

/**
 * Per-persona colorway for the mark. Survivor carries the one gradient
 * accent in the app; attorney and DV-org render as flat solid fills.
 */
export interface MarkColorway {
  kind: "solid" | "gradient";
  solid?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export const MARK_COLORWAYS: Record<Exclude<MarkVariant, "neutral">, MarkColorway> = {
  survivor: { kind: "gradient", gradientFrom: "#E5A1E4", gradientTo: "#A1BDF3" },
  attorney: { kind: "solid", solid: "#16235C" },
  advocate: { kind: "solid", solid: "#A9C4A0" },
};

export function markColorway(variant: MarkVariant = "neutral"): MarkColorway {
  return MARK_COLORWAYS[variant === "neutral" ? "survivor" : variant];
}

interface BrandMarkProps {
  /** Rendered height in px. */
  size?: number;
  /** Portal audience. "neutral" (default) renders the survivor colorway. */
  variant?: MarkVariant;
  /** Dark surface — reserved for future use; the mark itself doesn't change. */
  onDark?: boolean;
  className?: string;
}

/**
 * The PatternProof mark: a folded "P" ribbon. One geometry, three portal
 * colorways — survivor carries the gradient, attorney and DV-org are flat.
 */
export function BrandMark({
  size = 40,
  variant = "neutral",
  onDark: _onDark = false,
  className,
}: BrandMarkProps) {
  const colorway = markColorway(variant);
  const gradientId = useId();
  const fill = colorway.kind === "gradient" ? `url(#${gradientId})` : colorway.solid;
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block", overflow: "hidden" }}
    >
      {colorway.kind === "gradient" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorway.gradientFrom} />
            <stop offset="100%" stopColor={colorway.gradientTo} />
          </linearGradient>
        </defs>
      )}
      <path d={MARK_PATH} fill={fill} fillRule="evenodd" />
    </svg>
  );
}

export default BrandMark;
