import { APP_INK, PLEX, echoSteps } from "./echo";

interface EchoPProps {
  /** Number of echoed outline copies behind the solid glyph. */
  copies: number;
  size: number;
  ink?: string;
  className?: string;
  minOpacity?: number;
}

/**
 * The raw echoed "P" glyph — solid ink P with `copies` outline echoes
 * fanning up-right. Not used directly: compose it via BrandLockup (Tier 1)
 * or AppMark (Tier 2).
 */
export function EchoP({ copies, size, ink = APP_INK, className, minOpacity = 0.14 }: EchoPProps) {
  const steps = echoSteps(copies, minOpacity);
  const width = Math.round(size * (150 / 180));
  return (
    <svg
      viewBox="0 0 150 180"
      width={width}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      {steps.map((s, i) => (
        <text
          key={i}
          x={8 + s.x}
          y={152 + s.y}
          fontFamily={PLEX}
          fontWeight={700}
          fontSize={190}
          fill="none"
          stroke={ink}
          strokeWidth={2}
          opacity={s.opacity}
        >
          P
        </text>
      ))}
      <text x={8} y={152} fontFamily={PLEX} fontWeight={700} fontSize={190} fill={ink}>
        P
      </text>
    </svg>
  );
}

export default EchoP;