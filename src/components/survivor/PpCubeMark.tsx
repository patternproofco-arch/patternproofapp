interface PpCubeMarkProps {
  size?: number;
  /** Rendered on the dark forest sidebar. */
  onDark?: boolean;
  className?: string;
}

/**
 * PatternProof cube mark — an isometric cube whose front face carries a
 * geometric "P". Drawn in SVG so it stays crisp at any size and needs no
 * raster asset.
 */
export function PpCubeMark({ size = 28, onDark = true, className }: PpCubeMarkProps) {
  const top = onDark ? "#2A9468" : "#2A9468";
  const left = onDark ? "#17553A" : "#17553A";
  const right = onDark ? "#0D3825" : "#0D3825";
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
      <rect x="0" y="0" width="64" height="64" rx="14" fill={onDark ? "#FFFFFF" : "#0D3825"} opacity={onDark ? 0.06 : 0.04} />
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
