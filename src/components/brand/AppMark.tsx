import { CubeMark } from "./CubeMark";
import { INK, NAVY, PAPER, PLEX } from "./mark";

interface AppMarkProps {
  /** Mark height in px. Below 20px, use MicroMark instead. */
  size?: number;
  className?: string;
  /** Rendering on a dark/navy surface — strokes flip to white. */
  onDark?: boolean;
  /** Optional "PATTERNPROOF" wordmark beside the glyph. */
  withWordmark?: boolean;
  /** Legacy prop, retained so existing call sites keep compiling. */
  backing?: string;
}

/**
 * Tier 2 — App Mark. Cube glyph, optionally locked up with the wordmark.
 * Used everywhere inside the product: nav, auth pages, exports, attorney portal.
 */
export function AppMark({ size = 40, className, onDark = false, withWordmark = false }: AppMarkProps) {
  const glyph = <CubeMark size={size} onDark={onDark} />;
  if (!withWordmark) return <span className={className} style={{ display: "inline-flex" }}>{glyph}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {glyph}
      <span
        style={{
          fontFamily: PLEX,
          fontWeight: 600,
          fontSize: Math.max(11, Math.round(size * 0.32)),
          letterSpacing: "0.2em",
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
