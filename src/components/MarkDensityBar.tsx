import { useMemo } from "react";

interface Props {
  /** Marks feeding this Recurline. Only the date is used. */
  marks: Array<{ date: string | null }>;
  /** Number of weekly buckets to show. */
  weeks?: number;
}

/**
 * Purely visual density bar. Lighter = fewer / older Marks, darker = more
 * frequent / more recent Marks. No score, no threshold, no assessment —
 * the same visual language as the Marks Calendar.
 */
export function MarkDensityBar({ marks, weeks = 24 }: Props) {
  const buckets = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const msWeek = 7 * 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - (weeks - 1) * msWeek);
    const counts = new Array(weeks).fill(0) as number[];
    for (const m of marks) {
      if (!m.date) continue;
      const d = new Date(`${m.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const idx = Math.floor((d.getTime() - start.getTime()) / msWeek);
      if (idx >= 0 && idx < weeks) counts[idx] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((count, i) => {
      const recency = 0.45 + 0.55 * (i / Math.max(1, weeks - 1));
      const shade = Math.min(1, (count / max) * recency);
      return { count, shade };
    });
  }, [marks, weeks]);

  return (
    <div>
      <div
        className="flex h-10 w-full overflow-hidden rounded-2xl"
        style={{ boxShadow: "var(--pp-shadow-sm)" }}
      >
        {buckets.map((b, i) => (
          <div
            key={i}
            className="flex-1"
            title={`${b.count} ${b.count === 1 ? "Mark" : "Marks"}`}
            style={{
              background: `color-mix(in oklab, var(--accent) ${Math.round(12 + b.shade * 78)}%, var(--input))`,
            }}
          />
        ))}
      </div>
      <div
        className="mt-2 flex items-center justify-between text-[11px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span>Fewer / older Marks</span>
        <span>More frequent / more recent Marks</span>
      </div>
    </div>
  );
}
