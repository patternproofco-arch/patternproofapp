/**
 * Timezone-safe date helpers.
 *
 * `new Date("2026-05-21")` parses as UTC midnight, which renders as the
 * PREVIOUS calendar day in any timezone west of UTC. Always use these
 * helpers when displaying or comparing a YYYY-MM-DD string from the DB.
 */

/** Parse a YYYY-MM-DD string as a local-time Date (midnight in user's TZ). */
export function parseDateLocal(dateStr: string): Date {
  // Accept either "YYYY-MM-DD" or full ISO; for ISO we trust the timestamp.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

/** Format a YYYY-MM-DD string in the user's locale, timezone-safe. */
export function formatDateLocal(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  return parseDateLocal(dateStr).toLocaleDateString(undefined, options);
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Strip newlines and collapse whitespace — for single-line input sanitization. */
export function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Precision-aware label for an incident's date.
 * Never renders a bare exact date for a non-exact record — the stored `date`
 * field on approximate/range/anchor records is a sort-order helper, not a
 * factual claim.
 */
export interface IncidentDateFields {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_label?: string | null;
  anchor_incident?: { date?: string | null; description?: string | null } | null;
}

export function formatIncidentDate(i: IncidentDateFields): string {
  const p = i.date_precision ?? "exact";
  if (p === "unknown") return "Date not documented";
  if (p === "approximate_month") {
    const src = i.date_range_start || i.date;
    if (!src) return "Approximate date";
    const d = parseDateLocal(src);
    return `${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })} (approximate)`;
  }
  if (p === "range") {
    const s = i.date_range_start;
    const e = i.date_range_end;
    if (s && e) {
      return `Between ${formatDateLocal(s, { month: "short", day: "numeric", year: "numeric" })} and ${formatDateLocal(e, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (s) return `On or after ${formatDateLocal(s)}`;
    if (e) return `On or before ${formatDateLocal(e)}`;
    return "Date range";
  }
  if (p === "before_anchor" || p === "after_anchor") {
    const word = p === "before_anchor" ? "Before" : "After";
    if (i.anchor_label) return `${word} ${i.anchor_label}`;
    if (i.anchor_incident?.description) {
      const short = i.anchor_incident.description.slice(0, 60);
      return `${word} ${short}${i.anchor_incident.description.length > 60 ? "…" : ""}`;
    }
    return `${word} another event`;
  }
  // exact (default)
  if (!i.date) return "Date not documented";
  return formatDateLocal(i.date, { month: "short", day: "numeric", year: "numeric" });
}