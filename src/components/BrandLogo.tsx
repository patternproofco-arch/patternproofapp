import { BrandMark, DISPLAY, UI, OXBLOOD, PURPLE, RED_BRIGHT, LAV } from "@/components/BrandMark";
import type { MarkVariant } from "@/components/BrandMark";

interface BrandLogoProps {
  /** Height of the mark in px. Wordmark scales with it. */
  size?: number;
  className?: string;
  /** Show "The truth is in the pattern." beneath the wordmark. */
  showTagline?: boolean;
  /** Dark surface — mark and type shift to the bright accents. */
  onDark?: boolean;
  /** Portal audience for the cube mark. Defaults to the survivor colorway. */
  variant?: MarkVariant;
}

/**
 * The single PatternProof lockup: moiré mark + "PATTERNPROOF" wordmark.
 * There are no per-audience variants.
 */
export function BrandLogo({ size = 48, className, showTagline = false, onDark = false, variant = "neutral" }: BrandLogoProps) {
  const pattern = onDark ? RED_BRIGHT : OXBLOOD;
  const proof = onDark ? LAV : PURPLE;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
      <BrandMark size={size} onDark={onDark} variant={variant} />
      <span style={{ display: "inline-flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontWeight: 600,
            fontSize: Math.max(14, Math.round(size * 0.42)),
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: pattern }}>PATTERN</span>
          <span style={{ color: proof }}>PROOF</span>
        </span>
        {showTagline && (
          <span
            style={{
              marginTop: Math.max(3, Math.round(size * 0.1)),
              fontFamily: UI,
              fontWeight: 400,
              fontSize: Math.max(10, Math.round(size * 0.19)),
              letterSpacing: "0.02em",
              color: onDark ? "rgba(250,248,244,0.7)" : "var(--muted-foreground)",
            }}
          >
            The truth is in the pattern.
          </span>
        )}
      </span>
    </span>
  );
}

export default BrandLogo;
