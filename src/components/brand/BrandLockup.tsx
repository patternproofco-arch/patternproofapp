import { CubeMark } from "./CubeMark";
import { INK, MONO, PAPER, PLEX } from "./mark";

interface BrandLockupProps {
  /** Height of the mark itself, in px. Type scales with it. */
  size?: number;
  className?: string;
  /** Hide the tagline line (tight header placements). */
  showTagline?: boolean;
}

/**
 * Tier 1 — Brand Lockup. MARKETING ONLY.
 *
 * Ink card, paper-coloured nested cube (blurred outer / crisp inner), plus the
 * "PATTERNPROOF" wordmark and tagline.
 *
 * Allowed surfaces: marketing site header/hero, social share images, the
 * attorney one-pager PDF. Never inside the logged-in app, never in the attorney
 * portal, never in exports (use AppMark there).
 */
export function BrandLockup({ size = 92, className, showTagline = true }: BrandLockupProps) {
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 18,
        background: INK,
        padding: `${Math.round(size * 0.34)}px ${Math.round(size * 0.42)}px`,
      }}
    >
      <CubeMark size={size} />
      <div>
        <div
          style={{
            fontFamily: PLEX,
            fontWeight: 800,
            fontSize: Math.max(13, Math.round(size * 0.2)),
            letterSpacing: "0.18em",
            color: PAPER,
            lineHeight: 1.1,
          }}
        >
          PATTERNPROOF
        </div>
        {showTagline && (
          <div
            style={{
              marginTop: 8,
              fontFamily: MONO,
              fontSize: Math.max(9.5, Math.round(size * 0.115)),
              letterSpacing: "0.14em",
              color: "rgba(247,245,240,0.62)",
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
