import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

interface Props {
  incidents: Array<{ date: string; severity_level?: number | null; has_escalation_flag?: boolean | null }>;
  months?: number;
}

/**
 * Marks Calendar — heat map of Mark frequency over the last N months.
 * Pure client-side aggregation. Color intensity = count; red tint when any
 * incident that day has an escalation flag.
 */
export function IncidentHeatMap({ incidents, months = 6 }: Props) {
  const data = useMemo(() => {
    const byDate = new Map<string, { count: number; flagged: boolean; maxSev: number }>();
    for (const i of incidents) {
      const cur = byDate.get(i.date) ?? { count: 0, flagged: false, maxSev: 0 };
      cur.count += 1;
      if (i.has_escalation_flag) cur.flagged = true;
      if ((i.severity_level ?? 0) > cur.maxSev) cur.maxSev = i.severity_level ?? 0;
      byDate.set(i.date, cur);
    }
    return byDate;
  }, [incidents]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);

  const monthCells: Array<{ key: string; label: string; days: Array<{ date: string; day: number; cell: { count: number; flagged: boolean } | null }> }> = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const label = cursor.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    const lastDay = new Date(y, m + 1, 0).getDate();
    const firstWeekday = new Date(y, m, 1).getDay();
    const days: Array<{ date: string; day: number; cell: { count: number; flagged: boolean } | null }> = [];
    for (let i = 0; i < firstWeekday; i++) days.push({ date: "", day: 0, cell: null });
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cell = data.get(iso) ?? null;
      days.push({ date: iso, day: d, cell: cell ? { count: cell.count, flagged: cell.flagged } : null });
    }
    monthCells.push({ key: `${y}-${m}`, label, days });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const colorFor = (cell: { count: number; flagged: boolean } | null) => {
    if (!cell) return "var(--input)";
    const intensity = Math.min(1, 0.35 + cell.count * 0.22);
    if (cell.flagged) return `color-mix(in oklab, var(--primary) ${Math.round(intensity * 100)}%, var(--input))`;
    return `color-mix(in oklab, var(--accent) ${Math.round(intensity * 90)}%, var(--input))`;
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monthCells.map((mo) => (
          <div key={mo.key}>
            <div className="label-eyebrow mb-2">{mo.label}</div>
            <div className="grid grid-cols-7 gap-1">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>{d}</div>
              ))}
              {mo.days.map((d, i) => (
                d.day === 0 ? <div key={i} /> : (
                  <Link
                    key={i}
                    to="/timeline"
                    title={`${d.date}${d.cell ? ` · ${d.cell.count} Mark${d.cell.count > 1 ? "s" : ""}` : ""}`}
                    className="aspect-square rounded text-center text-[10px] leading-none"
                    style={{ background: colorFor(d.cell), color: d.cell ? "var(--sidebar-active)" : "var(--muted-foreground)", paddingTop: 4 }}
                  >
                    {d.day}
                  </Link>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <span>Quiet</span>
        <div className="flex gap-1">
          {[0,1,2,3,4].map((n) => (
            <div key={n} className="h-3 w-3 rounded" style={{ background: `color-mix(in oklab, var(--accent) ${20 + n * 20}%, var(--input))` }} />
          ))}
        </div>
        <span>More frequent</span>
        <div className="ml-3 h-3 w-3 rounded" style={{ background: "color-mix(in oklab, var(--primary) 70%, var(--input))" }} />
        <span>Flagged</span>
      </div>
    </div>
  );
}