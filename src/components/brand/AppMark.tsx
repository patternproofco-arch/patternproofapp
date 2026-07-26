import { BlurP } from "./BlurP";
import { INK, PAPER, PLEX } from "./mark";

interface AppMarkProps {
  /** Mark height in px. Below 20px, use MicroMark instead. */
  size?: number;
  className?: string;
  /** Dark/navy surface (attorney portal nav, dark footers) — paper ink. */
  onDark?: boolean;
  /** Optional "PATTERNPROOF" wordmark beside the glyph. */
  withWordmark?: boolean;
  /** Surface colour behind the mark, used for the negative-space cut. */
  surface?: string;
}

/**
 * Tier 2 — App Mark. Blur-to-crisp P, ink on paper (or paper on navy).
 *
 * The negative-space notch is kept only at comfortable sizes (>= 32px); below
 * that it closes up into mud, so we drop it and keep the blur-to-crisp
 * gradient, which is the core idea.
 *
 * Use everywhere inside the logged-in app, in the attorney portal, in
 * attorney emails, and on exports.
 */
export function AppMark({ size = 40, className, onDark = false, withWordmark = false, surface }: AppMarkProps) {
  const ink = onDark ? PAPER : INK;
  const cut = surface ?? (onDark ? "#152038" : PAPER);
  const glyph = <BlurP size={size} ink={ink} cut={cut} withCut={size >= 32} />;
  if (!withWordmark) return <span className={className}>{glyph}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {glyph}
      <span
        style={{
          fontFamily: PLEX,
          fontWeight: 800,
          fontSize: Math.max(12, Math.round(size * 0.34)),
          letterSpacing: "0.1em",
          color: ink,
        }}
      >
        PATTERNPROOF
      </span>
    </span>
  );
}

export default AppMark;
