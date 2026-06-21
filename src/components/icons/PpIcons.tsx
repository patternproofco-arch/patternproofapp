import type { ReactElement } from "react";

type IconProps = {
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
};

const base = (size: number, color: string, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: color,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  className,
});

/** Upload Evidence — page with up arrow. */
export function UploadDocIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 18v-6" />
      <path d="M9.5 14.5 12 12l2.5 2.5" />
    </svg>
  );
}

/** Timeline — horizontal line with three dots sitting above it. */
export function TimelineDotsIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      <circle cx="6" cy="9" r="1.4" fill={color} stroke="none" />
      <circle cx="12" cy="9" r="1.4" fill={color} stroke="none" />
      <circle cx="18" cy="9" r="1.4" fill={color} stroke="none" />
      <path d="M3 15h18" />
      <path d="M6 15v-2M12 15v-2M18 15v-2" opacity="0.55" />
    </svg>
  );
}

/** Court Calendar — month-view grid. */
export function CalendarGridIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3M16 3.5v3" />
      <path d="M9 13.5h.01M12 13.5h.01M15 13.5h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01" />
    </svg>
  );
}

/** Pattern Detection — circle composed of dots. */
export function DotCirclePatternIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  const r = 8;
  const cx = 12;
  const cy = 12;
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.15} fill={color} stroke="none" />
      ))}
      <circle cx={cx} cy={cy} r={1.6} fill={color} stroke="none" opacity="0.85" />
    </svg>
  );
}

/** P4TTERN PR00F Agent — triangle outline with "PP" inside. */
export function PpTriangleIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      <path d="M12 3.2 21 19.5H3z" />
      <text
        x="12"
        y="16.3"
        textAnchor="middle"
        fontFamily="Georgia, 'Palatino Linotype', serif"
        fontWeight={700}
        fontSize="7.2"
        fontStyle="italic"
        fill={color}
        stroke="none"
      >
        PP
      </text>
    </svg>
  );
}

/** Court Summary — legal document with a justice scale on the page. */
export function CourtSummaryIcon({ size = 24, strokeWidth = 1.75, color = "currentColor", className }: IconProps): ReactElement {
  return (
    <svg {...base(size, color, strokeWidth, className)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 12v6" />
      <path d="M9 18h6" />
      <path d="M9.5 13.5h5" />
      <path d="M8.5 15.5 9.5 13.5l1 2" opacity="0.7" />
      <path d="M13.5 15.5l1-2 1 2" opacity="0.7" />
    </svg>
  );
}