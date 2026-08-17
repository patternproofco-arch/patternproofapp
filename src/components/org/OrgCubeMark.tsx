interface OrgCubeMarkProps {
  size?: number;
  className?: string;
}

/**
 * PatternProof geometric cube/P mark, sage colourway.
 * Inline SVG so the DV-org portal needs no raster asset.
 */
export function OrgCubeMark({ size = 28, className }: OrgCubeMarkProps) {
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
      <rect x="0" y="0" width="64" height="64" rx="16" fill="#E3EFE6" />
      <polygon points="32,10 54,22 32,34 10,22" fill="#A9CDB6" />
      <polygon points="10,22 32,34 32,54 10,42" fill="#6F9C7E" />
      <polygon points="54,22 54,42 32,54 32,34" fill="#4C7359" />
      <path
        d="M25.5 45V30h6.8a4.4 4.4 0 0 1 0 8.8h-3.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
    </svg>
  );
}

export default OrgCubeMark;
