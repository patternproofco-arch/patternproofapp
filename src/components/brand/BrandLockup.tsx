import { CubeMark } from "./CubeMark";
import { INK, MONO, PAPER, PLEX } from "./mark";

interface BrandLockupProps {
  /** Height of the mark itself, in px. Type scales with it. */
  size?: number;
  className?: string;
  /** Hide the tagline line (tight header placements). */
  showTagline?: boolean;
  /** Dark surface — strokes and type flip to paper. */
  onDark?: boolean;
}

/**
 * Tier 1 — Brand Lockup: cube + "PATTERNPROOF" + optional tagline.
 * Ink on paper, no card, no gradient.
 */
export function BrandLockup({ size = 64, className, showTagline = true, onDark = false }: BrandLockupProps) {
  const fg = onDark ? PAPER : INK;
  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
      <CubeMark size={size} onDark={onDark} />
      <div>
        <div
          style={{
            fontFamily: PLEX,
            fontWeight: 600,
            fontSize: Math.max(13, Math.round(size * 0.26)),
            letterSpacing: "0.2em",
            color: fg,
            lineHeight: 1.1,
          }}
        >
          PATTERNPROOF
        </div>
        {showTagline && (
          <div
            style={{
              marginTop: 7,
              fontFamily: MONO,
              fontSize: Math.max(9.5, Math.round(size * 0.145)),
              letterSpacing: "0.14em",
              color: onDark ? "rgba(247,245,240,0.66)" : "#8A8894",
            }}
          >
            THE PROOF IS IN THE PATTERN
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandLockup;
