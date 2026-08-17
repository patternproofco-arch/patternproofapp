interface PpCubeMarkProps {
  size?: number;
  /** Kept for call-site compatibility; the survivor mark is light-surface. */
  onDark?: boolean;
  className?: string;
}

/**
 * PatternProof survivor mark — an isometric cube / portal in the survivor
 * lavender-and-indigo range, drawn in SVG so it stays crisp at any size.
 */
export function PpCubeMark({ size = 28, onDark = false, className }: PpCubeMarkProps) {
  const top = "#B49FD4";
  const left = "#5E3A85";
  const right = "#3D2260";
  const glyph = "#FFFFFF";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block" }}
    >
      <rect x="0" y="0" width="64" height="64" rx="16" fill={onDark ? "#FFFFFF" : "#4A2A6B"} opacity="0.06" />
      <polygon points="32,8 56,21 32,34 8,21" fill={top} />
      <polygon points="8,21 32,34 32,56 8,43" fill={left} />
      <polygon points="56,21 56,43 32,56 32,34" fill={right} />
      <path
        d="M25 44V29h7.5a4.5 4.5 0 0 1 0 9H29"
        fill="none"
        stroke={glyph}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
    </svg>
  );
}

export default PpCubeMark;
