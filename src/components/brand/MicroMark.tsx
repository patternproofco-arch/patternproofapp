import { APP_INK, PAPER, PLEX } from "./echo";

interface MicroMarkProps {
  size?: number;
  className?: string;
  onDark?: boolean;
}

/**
 * Tier 3 — Micro Mark. Favicon / app-icon sizes only (16-32px).
 * Solid single "P", no echo lines — at this size the echoes smudge.
 */
export function MicroMark({ size = 24, className, onDark = false }: MicroMarkProps) {
  return (
    <svg
      viewBox="0 0 150 180"
      width={Math.round(size * (150 / 180))}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block" }}
    >
      <text x={8} y={152} fontFamily={PLEX} fontWeight={700} fontSize={190} fill={onDark ? PAPER : APP_INK}>
        P
      </text>
    </svg>
  );
}

export default MicroMark;