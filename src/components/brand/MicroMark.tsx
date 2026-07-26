import { INK, PAPER, PLEX } from "./mark";

interface MicroMarkProps {
  size?: number;
  className?: string;
  onDark?: boolean;
}

/**
 * Tier 3 — Micro Mark. Favicon / app-icon sizes only (16-32px).
 * Solid crisp "P": no blur, no negative-space cut — both turn to mud here.
 */
export function MicroMark({ size = 24, className, onDark = false }: MicroMarkProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block" }}
    >
      <text x="30" y="160" fontFamily={PLEX} fontWeight={700} fontSize={140} fill={onDark ? PAPER : INK}>
        P
      </text>
    </svg>
  );
}

export default MicroMark;
