import { CubeMark } from "./CubeMark";

interface MicroMarkProps {
  size?: number;
  className?: string;
  /** Dark surface — strokes flip to white. */
  onDark?: boolean;
}

/**
 * Tier 3 — Micro Mark. Favicon / app-icon sizes (16-40px).
 * Same cube with heavier strokes so it survives at small sizes.
 */
export function MicroMark({ size = 24, className, onDark = false }: MicroMarkProps) {
  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <CubeMark size={size} onDark={onDark} strokeWidth={3} />
    </span>
  );
}

export default MicroMark;
