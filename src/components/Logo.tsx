// Standalone ink-line mark — the clipped-45°-corner exhibit-card shape at icon
// scale, so the brand mark and the exhibit cards throughout the app share one
// visual source of truth.
export type LogoVariant = "attorney" | "survivor" | "org";

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  onDark?: boolean;
}

export function Logo({ size = 40, className, onDark = false }: LogoProps) {
  const stroke = onDark ? "#F7F5F0" : "#14131F";
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-label="PatternProof"
      role="img"
      className={className}
      style={{ display: "block" }}
    >
      <path
        d="M8 8 H50 L64 22 V64 H8 Z"
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinejoin="miter"
      />
      <path
        d="M50 8 V22 H64"
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export default Logo;