export const OXBLOOD = "#4132B4";
export const OXBLOOD_DEEP = "#33268C";
export const PURPLE = "#196CD4";
export const PURPLE_MID = "#1552A3";
export const RED_BRIGHT = "#A38BEB";
export const LAV = "#7EB6FF";
export const INK = "#1A1224";
export const PAPER = "#FAF8F4";
export const DISPLAY = "'Fraunces', Georgia, serif";
export const UI = "'Space Grotesk', system-ui, sans-serif";

const RADII = [14, 27, 40, 53, 66, 79, 92];

interface BrandMarkProps {
  /** Rendered height in px. */
  size?: number;
  /** Dark surface — rings switch to bright red / lavender and screen blending. */
  onDark?: boolean;
  className?: string;
}

/**
 * The PatternProof mark: two offset concentric-ring systems whose overlap
 * produces a moiré interference pattern — the pattern only appears when the
 * two records are laid over each other.
 */
export function BrandMark({ size = 40, onDark = false, className }: BrandMarkProps) {
  const left = onDark ? RED_BRIGHT : OXBLOOD;
  const right = onDark ? LAV : PURPLE;
  const blend = onDark ? "screen" : "multiply";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block", overflow: "hidden" }}
    >
      <g style={{ mixBlendMode: blend as React.CSSProperties["mixBlendMode"] }}>
        <g stroke={left} strokeWidth={2} fill="none">
          {RADII.map((r) => (
            <circle key={`l${r}`} cx={88} cy={100} r={r} />
          ))}
        </g>
        <g stroke={right} strokeWidth={2} fill="none">
          {RADII.map((r) => (
            <circle key={`r${r}`} cx={112} cy={100} r={r} />
          ))}
        </g>
      </g>
    </svg>
  );
}

export default BrandMark;
