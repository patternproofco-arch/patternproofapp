import { BrandMark, DISPLAY, UI, INK, PAPER } from "@/components/BrandMark";
import type { MarkVariant } from "@/components/BrandMark";

interface BrandLogoProps {
  /** Height of the mark in px. Wordmark scales with it. */
  size?: number;
  className?: string;
  /** Show "The truth is in the pattern." beneath the wordmark. */
  showTagline?: boolean;
  /** Dark surface — mark and type shift to the bright accents. */
  onDark?: boolean;
  /** Portal audience for the mark. Defaults to the survivor colorway. */
  variant?: MarkVariant;
}

/**
 * The single PatternProof lockup: the "P" mark + "PATTERNPROOF" wordmark.
 * There are no per-audience variants.
 */
export function BrandLogo({ size = 48, className, showTagline = false, onDark = false, variant = "neutral" }: BrandLogoProps) {
  const wordmarkColor = onDark ? PAPER : INK;
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
            color: wordmarkColor,
          }}
        >
          PATTERNPROOF
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
