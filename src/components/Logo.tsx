// PatternProof mark — mirrored double-P.
//
// Primary: a solid ink "P" with a second, mirrored "P" painted in the paper
// colour overlapping it, cutting a negative-space edge into the first. This
// only reads on paper-coloured (#F7F5F0) surfaces.
//
// Fallback: a single solid "P" (ink on light, paper on dark) for navy headers,
// dark footers, photo backgrounds and very small icon sizes where the cut
// wouldn't read anyway.
export type LogoVariant = "attorney" | "survivor" | "org";

const INK = "#14131F";
const PAPER = "#F7F5F0";
const FONT = "'IBM Plex Sans', system-ui, sans-serif";

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  /** Dark/navy background — uses the paper-coloured solid fallback. */
  onDark?: boolean;
  /** Force the solid-ink fallback on a light-but-not-paper background. */
  solid?: boolean;
}

export function Logo({ size = 40, className, onDark = false, solid = false }: LogoProps) {
  // Height-driven sizing: the mark's box is 260x180.
  const height = size;
  const useFallback = onDark || solid || size < 20;
  const width = useFallback ? Math.round(size * (140 / 180)) : Math.round(size * (260 / 180));

  if (useFallback) {
    return (
      <svg
        viewBox="0 0 140 180"
        width={width}
        height={height}
        aria-label="PatternProof"
        role="img"
        className={className}
        style={{ display: "block" }}
      >
        <text x="0" y="150" fontFamily={FONT} fontWeight={800} fontSize={200} fill={onDark ? PAPER : INK}>
          P
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 260 180"
      width={width}
      height={height}
      aria-label="PatternProof"
      role="img"
      className={className}
      style={{ display: "block" }}
    >
      <text x="0" y="150" fontFamily={FONT} fontWeight={800} fontSize={200} fill={INK}>
        P
      </text>
      <text
        x="122"
        y="150"
        fontFamily={FONT}
        fontWeight={800}
        fontSize={200}
        fill={PAPER}
        transform="scale(-1,1) translate(-366,0)"
      >
        P
      </text>
    </svg>
  );
}

export default Logo;