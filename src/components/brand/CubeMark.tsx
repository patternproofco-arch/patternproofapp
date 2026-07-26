import { useId } from "react";
import { PAPER } from "./mark";

interface CubeMarkProps {
  /** Rendered height in px. */
  size: number;
  /** Line colour. Paper by default — needs a dark backing behind it. */
  stroke?: string;
  /**
   * Drop the Gaussian blur and express the outer cube with opacity instead.
   * Required below ~40px, where the blur turns to mud.
   */
  simplified?: boolean;
  className?: string;
}

/**
 * The PatternProof mark: a nested cube. The larger outer cube is blurred
 * (the bigger picture still resolving); the smaller inner cube is crisp
 * (the confirmed truth at the centre). Paper-coloured line art, no fill.
 *
 * NEVER render this directly on a light surface — it is invisible. Compose it
 * through BrandLockup / AppMark / MicroMark, which supply the dark backing.
 */
export function CubeMark({ size, stroke = PAPER, simplified = false, className }: CubeMarkProps) {
  const uid = useId().replace(/:/g, "");
  const blur = `pp-cube-blur-${uid}`;
  const small = simplified || size < 40;

  return (
    <svg
      viewBox="0 0 180 190"
      width={(size * 180) / 190}
      height={size}
      role="img"
      aria-label="PatternProof"
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      {!small && (
        <defs>
          <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.4" />
          </filter>
        </defs>
      )}
      <g
        filter={small ? undefined : `url(#${blur})`}
        stroke={stroke}
        strokeWidth={small ? 4 : 5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity={small ? 0.35 : 0.55}
      >
        <path d="M90 20 L155 58 L155 132 L90 170 L25 132 L25 58 Z" />
        <line x1="90" y1="90" x2="90" y2="170" />
        <line x1="90" y1="90" x2="155" y2="58" />
        <line x1="90" y1="90" x2="25" y2="58" />
      </g>
      <g stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M90 53.75 L125.75 74.65 L125.75 115.35 L90 136.25 L54.25 115.35 L54.25 74.65 Z" />
        <line x1="90" y1="92.25" x2="90" y2="136.25" />
        <line x1="90" y1="92.25" x2="125.75" y2="74.65" />
        <line x1="90" y1="92.25" x2="54.25" y2="74.65" />
      </g>
    </svg>
  );
}

export default CubeMark;
