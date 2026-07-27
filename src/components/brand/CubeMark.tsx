import { INK, TEAL } from "./mark";

interface CubeMarkProps {
  /** Rendered height in px. */
  size: number;
  /** On dark/navy surfaces the strokes flip to white. Teal top face stays. */
  onDark?: boolean;
  /** Heavier strokes for favicon / very small renders. */
  strokeWidth?: number;
  className?: string;
}

/**
 * The PatternProof mark: an isometric cube. The top face is teal (confirmed);
 * the remaining faces are outlined (still resolving).
 *
 * Works on paper and on dark surfaces — pass `onDark` for navy/ink backgrounds.
 */
export function CubeMark({ size, onDark = false, strokeWidth = 2.2, className }: CubeMarkProps) {
  const stroke = onDark ? "#FFFFFF" : INK;
  return (
    <svg
      viewBox="0 0 58 64"
      width={(size * 58) / 64}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block" }}
    >
      <path d="M29 2 L55 17 L29 32 L3 17 Z" fill={TEAL} />
      <path
        d="M29 2 L55 17 L55 47 L29 62 L3 47 L3 17 Z"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M29 32 L29 62 M29 32 L3 17 M29 32 L55 17"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
}

export default CubeMark;
