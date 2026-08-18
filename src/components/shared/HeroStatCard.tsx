import { PORTAL_THEME, type PortalVariant } from "@/components/shared/portal-theme";

export interface HeroStatCardProps {
  label: string;
  value: number | string;
  /** e.g. "+12% vs last month". Omit while unknown. */
  deltaLabel?: string;
  /** Direction only affects the badge tint, never a judgement. */
  deltaDirection?: "up" | "down" | "flat";
  /** Ordered series, oldest first. */
  sparklineData?: number[];
  caption?: string;
  variant?: PortalVariant;
  gradientFrom?: string;
  gradientTo?: string;
}

function sparklinePath(data: number[], w: number, h: number) {
  if (data.length < 2) return "";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/** Full-width headline stat with a quiet trend line. Shared across portals. */
export function HeroStatCard({
  label,
  value,
  deltaLabel,
  deltaDirection = "flat",
  sparklineData = [],
  caption,
  variant = "survivor",
  gradientFrom,
  gradientTo,
}: HeroStatCardProps) {
  const t = PORTAL_THEME[variant];
  const from = gradientFrom ?? t.gradientFrom;
  const to = gradientTo ?? t.gradientTo;
  const W = 320;
  const H = 48;
  const path = sparklinePath(sparklineData, W, H);
  const area = path ? `${path} L${W},${H} L0,${H} Z` : "";
  const gid = `spark-${variant}-${label.replace(/\W+/g, "")}`;

  return (
    <section
      className="w-full"
      style={{
        borderRadius: 24,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        border: `1px solid ${t.line}`,
        padding: "22px 24px",
        boxShadow: "0 10px 30px -24px rgba(20,10,40,0.35)",
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <span
            className="block text-[12px]"
            style={{ letterSpacing: "0.1em", textTransform: "uppercase", color: t.muted, fontWeight: 600 }}
          >
            {label}
          </span>
          <span
            className="mt-1 block"
            style={{
              fontFamily: t.displayFont,
              fontSize: 46,
              lineHeight: 1.05,
              fontWeight: 600,
              color: t.accent,
            }}
          >
            {value}
          </span>
          {caption && (
            <span className="mt-1 block text-[12.5px]" style={{ color: t.muted }}>
              {caption}
            </span>
          )}
        </div>
        {deltaLabel && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px]"
            style={{
              background: t.accentSoft,
              color: t.accent,
              fontWeight: 600,
              border: `1px solid ${t.line}`,
            }}
            aria-label={`${deltaLabel} (${deltaDirection})`}
          >
            {deltaLabel}
          </span>
        )}
      </div>

      {path && (
        <svg
          className="mt-4 w-full"
          viewBox={`0 0 ${W} ${H}`}
          height={H}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${label} trend`}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={t.accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={t.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={path} fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </section>
  );
}

export default HeroStatCard;
