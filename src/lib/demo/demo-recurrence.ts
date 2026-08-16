import type { DemoIncident } from "./demo-data";

export interface RecurrenceGroup {
  label: string;
  count: number;
  dates: string[];
  span: string;
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/**
 * Frequency and recurrence only. This counts what was recorded and groups
 * records that share a category — it does not judge, diagnose, or interpret
 * the behaviour described. Any conclusion is the reader's to draw.
 */
export function recurrenceByCategory(incidents: DemoIncident[]): RecurrenceGroup[] {
  const map = new Map<string, string[]>();
  for (const incident of incidents) {
    for (const category of incident.categories) {
      map.set(category, [...(map.get(category) ?? []), incident.date]);
    }
  }
  return [...map.entries()]
    .map(([label, dates]) => {
      const sorted = [...dates].sort();
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      return {
        label,
        count: sorted.length,
        dates: sorted,
        span: first === last ? first : `${first} → ${last}`,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Records per calendar month, oldest first. Counts only. */
export function recordsPerMonth(incidents: DemoIncident[]) {
  const map = new Map<string, number>();
  for (const incident of incidents) {
    map.set(monthKey(incident.date), (map.get(monthKey(incident.date)) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
}
