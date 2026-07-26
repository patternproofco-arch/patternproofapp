import { CubeMark } from "./CubeMark";
import { INK, NAVY, PAPER, PLEX } from "./mark";

interface AppMarkProps {
  /** Mark height in px. Below 20px, use MicroMark instead. */
  size?: number;
  className?: string;
  /** Already on a dark/navy surface — skip the backing chip. */
  onDark?: boolean;
  /** Optional "PATTERNPROOF" wordmark beside the glyph. */
  withWordmark?: boolean;
  /** Override the backing colour (ink by default, navy in attorney contexts). */
  backing?: string;
}

/**
 * Tier 2 — App Mark. Nested cube in paper line art on a dark backing chip.
 *
 * The mark is paper-coloured, so on light surfaces this component draws its own
 * dark square behind it. On an already-dark surface (attorney nav, dark footer)
 * pass `onDark` and the chip is dropped.
 *
 * Use everywhere inside the logged-in app, in the attorney portal, in attorney
 * emails, and on exports. Never Tier 1 in those contexts.
 */
export function AppMark({ size = 40, className, onDark = false, withWordmark = false, backing }: AppMarkProps) {
  const pad = Math.round(size * 0.2);
  const glyph = <CubeMark size={size} />;
  const chip = onDark ? (
    glyph
  ) : (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: backing ?? INK,
        padding: pad,
        borderRadius: Math.max(3, Math.round(size * 0.1)),
      }}
    >
      {glyph}
    </span>
  );
  if (!withWordmark) return <span className={className} style={{ display: "inline-flex" }}>{chip}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {chip}
      <span
        style={{
          fontFamily: PLEX,
          fontWeight: 800,
          fontSize: Math.max(12, Math.round(size * 0.34)),
          letterSpacing: "0.1em",
          color: onDark ? PAPER : INK,
        }}
      >
        PATTERNPROOF
      </span>
    </span>
  );
}

export const ATTORNEY_BACKING = NAVY;

export default AppMark;
