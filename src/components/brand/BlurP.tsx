import { useId } from "react";
import { INK, PAPER, PLEX } from "./mark";

interface BlurPProps {
  /** Rendered height in px (the mark is square). */
  size: number;
  /** Colour of the P itself. */
  ink?: string;
  /** Colour of the mirrored negative-space P — must match the surface behind. */
  cut?: string;
  /** Drop the negative-space notch (small sizes / dense nav). */
  withCut?: boolean;
  className?: string;
}

/**
 * The raw blur-to-crisp "P" glyph. Not used directly — compose it through
 * BrandLockup (marketing) or AppMark (in-product).
 */
export function BlurP({ size, ink = INK, cut = PAPER, withCut = true, className }: BlurPProps) {
  const uid = useId().replace(/:/g, "");
  const blur = `pp-blur-${uid}`;
  const fadeL = `pp-fadeL-${uid}`;
  const fadeR = `pp-fadeR-${uid}`;
  const maskL = `pp-maskL-${uid}`;
  const maskR = `pp-maskR-${uid}`;

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
      <defs>
        <filter id={blur}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <linearGradient id={fadeL} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" />
          <stop offset="65%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </linearGradient>
        <linearGradient id={fadeR} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="black" />
          <stop offset="35%" stopColor="black" />
          <stop offset="100%" stopColor="white" />
        </linearGradient>
        <mask id={maskL}>
          <rect width="220" height="220" fill={`url(#${fadeL})`} />
        </mask>
        <mask id={maskR}>
          <rect width="220" height="220" fill={`url(#${fadeR})`} />
        </mask>
      </defs>

      <g mask={`url(#${maskL})`}>
        <text x="30" y="160" fontFamily={PLEX} fontWeight={700} fontSize={140} fill={ink} filter={`url(#${blur})`}>
          P
        </text>
      </g>
      <g mask={`url(#${maskR})`}>
        <text x="30" y="160" fontFamily={PLEX} fontWeight={700} fontSize={140} fill={ink}>
          P
        </text>
      </g>
      {withCut && (
        <text
          x="90"
          y="160"
          fontFamily={PLEX}
          fontWeight={700}
          fontSize={140}
          fill={cut}
          transform="scale(-1,1) translate(-278,0)"
        >
          P
        </text>
      )}
    </svg>
  );
}

export default BlurP;
