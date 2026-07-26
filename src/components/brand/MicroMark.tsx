import { CubeMark } from "./CubeMark";
import { INK } from "./mark";

interface MicroMarkProps {
  size?: number;
  className?: string;
  /** Already on a dark surface — skip the backing square. */
  onDark?: boolean;
}

/**
 * Tier 3 — Micro Mark. Favicon / app-icon sizes (16-40px).
 * Same nested cube, but no blur: the outer cube is expressed with opacity so
 * the hierarchy survives at tiny sizes. Always on a dark square.
 */
export function MicroMark({ size = 24, className, onDark = false }: MicroMarkProps) {
  const glyph = <CubeMark size={Math.round(size * 0.78)} simplified />;
  if (onDark) return <span className={className} style={{ display: "inline-flex" }}>{glyph}</span>;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: INK,
        borderRadius: Math.max(2, Math.round(size * 0.16)),
      }}
    >
      {glyph}
    </span>
  );
}

export default MicroMark;
