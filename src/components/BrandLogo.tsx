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
  // Diamond facets per brand sheet
  const topFill = isLight ? "#EFE6D8" : "#2E2926";
  const leftFill = isLight ? "#1A1714" : "#FAF7F2";
  const rightFill = "#D4708A";
  const lineStroke = isLight ? "#FAF7F2" : "#1A1714";
  const lineOpacity = isLight ? 0.35 : 0.4;
  const patternColor = isLight ? "#1A1714" : "#FAF7F2";
  const proofColor = "#D4708A";
  const shadow = withShadow ? "drop-shadow(0 1px 0 rgba(0,0,0,0.10))" : undefined;
  // Scale glyph height to wordmark
  const markH = Math.round(maxWidth * 0.26);
  const markW = Math.round(markH * (100 / 110));
  const pSize = Math.max(14, Math.round(maxWidth * 0.115));
  const prSize = Math.max(9, Math.round(pSize * 0.55));

  return (
    <Link
      to="/dashboard"
      aria-label="PatternProof — return to dashboard"
      className={"inline-flex items-center gap-3 " + (className ?? "")}
      style={{ maxWidth, filter: shadow, fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <svg
        viewBox="0 0 100 110"
        width={markW}
        height={markH}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <polygon points="50,10 85,30 50,50 15,30" fill={topFill} />
        <polygon points="15,30 50,50 50,90 15,70" fill={leftFill} />
        <polygon points="50,50 85,30 85,70 50,90" fill={rightFill} />
        <line x1="50" y1="63" x2="85" y2="43" stroke={lineStroke} strokeWidth="1.4" opacity={lineOpacity} />
        <line x1="50" y1="73" x2="85" y2="53" stroke={lineStroke} strokeWidth="1.4" opacity={lineOpacity} />
        <line x1="50" y1="83" x2="85" y2="63" stroke={lineStroke} strokeWidth="1.4" opacity={lineOpacity} />
        <line x1="62" y1="43" x2="62" y2="83" stroke={lineStroke} strokeWidth="1.4" opacity={lineOpacity} />
        <line x1="74" y1="36" x2="74" y2="76" stroke={lineStroke} strokeWidth="1.4" opacity={lineOpacity} />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          style={{
            color: patternColor,
            fontWeight: 900,
            fontSize: pSize,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Pattern
        </span>
        <span
          style={{
            color: proofColor,
            fontWeight: 700,
            fontSize: prSize,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginTop: 5,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            lineHeight: 1,
          }}
        >
          <span style={{ height: 1, width: 12, background: proofColor, display: "inline-block" }} />
          Proof
          <span style={{ height: 1, width: 12, background: proofColor, display: "inline-block" }} />
        </span>
      </div>
    </Link>
  );
}

export default BrandLogo;