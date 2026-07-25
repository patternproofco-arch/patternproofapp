import { APP_INK, PAPER } from "./echo";
import { EchoP } from "./EchoP";

interface AppMarkProps {
  /** Mark height in px. Below 20px, use MicroMark instead. */
  size?: number;
  className?: string;
  /** Dark/navy surface (attorney portal nav, dark footers) — paper ink. */
  onDark?: boolean;
  /** Optional "PatternProof" wordmark beside the glyph. */
  withWordmark?: boolean;
}

/**
 * Tier 2 — App Mark. Ink on paper, only 3 echo copies.
 *
 * Deliberately quieter than the Tier 1 lockup: the survivor sees this on
 * every screen, and a dense repeated-line mark risks a moiré / visual-stress
 * effect for sensory sensitivity. No lavender card, no tagline.
 *
 * Use everywhere inside the logged-in app, in the attorney portal, in
 * attorney emails, and on exports.
 */
export function AppMark({ size = 40, className, onDark = false, withWordmark = false }: AppMarkProps) {
  const ink = onDark ? PAPER : APP_INK;
  const glyph = <EchoP copies={3} size={size} ink={ink} minOpacity={0.22} />;
  if (!withWordmark) return <span className={className}>{glyph}</span>;
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {glyph}
      <span
        style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
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