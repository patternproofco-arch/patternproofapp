import { Link } from "@tanstack/react-router";

type Variant = "light" | "dark";

interface BrandLogoProps {
  variant?: Variant;
  /** Max width in px. Defaults to 180 (desktop). */
  maxWidth?: number;
  className?: string;
  withShadow?: boolean;
}

/**
 * Pattern-Proof brand lockup: geometric tessellation mark + wordmark.
 * Forensic / legal-tech aesthetic — deep navy on light, ivory on dark.
 * Clickable, routes to /dashboard.
 */
export function BrandLogo({
  variant = "dark",
  maxWidth = 180,
  className,
  withShadow = false,
}: BrandLogoProps) {
  const isLight = variant === "light";
  const stroke = isLight ? "#F7F3EC" : "#2A2520";
  const fill = isLight ? "#F7F3EC" : "#2A2520";
  const accent = "#7A9479";
  const accentSquare = "#7A9479";
  const shadow = withShadow
    ? "drop-shadow(0 1px 0 rgba(0,0,0,0.10))"
    : undefined;

  return (
    <Link
      to="/dashboard"
      aria-label="Pattern-Proof — return to dashboard"
      className={"inline-flex items-center gap-2.5 " + (className ?? "")}
      style={{ maxWidth, width: "100%", filter: shadow }}
    >
      <svg
        viewBox="0 0 32 32"
        width="28"
        height="28"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Interlocking geometric pattern — tessellation cue */}
        <rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke={stroke} strokeWidth="2" />
        <rect x="18" y="2" width="12" height="12" rx="1.5" fill="none" stroke={stroke} strokeWidth="2" />
        <rect x="2" y="18" width="12" height="12" rx="1.5" fill="none" stroke={stroke} strokeWidth="2" />
        <rect x="18" y="18" width="12" height="12" rx="1.5" fill={accentSquare} stroke={stroke} strokeWidth="2" />
        <line x1="14" y1="8" x2="18" y2="8" stroke={stroke} strokeWidth="2" />
        <line x1="8" y1="14" x2="8" y2="18" stroke={stroke} strokeWidth="2" />
      </svg>
      <span
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontWeight: 400,
          fontSize: "20px",
          letterSpacing: "-0.005em",
          textTransform: "none",
          color: fill,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Pattern<span style={{ color: accent }}>Proof</span>
      </span>
    </Link>
  );
}

export default BrandLogo;