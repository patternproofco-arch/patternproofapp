/**
 * Dates on entries.
 *
 * Three different dates are never mixed up:
 *   - when it HAPPENED (this module): exactly as sure as the survivor is;
 *   - when she ENTERED it (created_at, set by the database);
 *   - for a file, what its own metadata says (kept separately, never promoted to the above).
 *
 * "I don't know" stays "I don't know". An empty date is never turned into today, and a
 * record with no date is never labelled "exact".
 */

export type Precision =
  | "exact"
  | "approximate_month"
  | "range"
  | "before_anchor"
  | "after_anchor"
  | "unknown";

export type DateForm = {
  date_precision: Precision;
  /** YYYY-MM-DD, used for "exact". */
  date: string;
  /** YYYY-MM, used for "approximate_month". */
  approx_month: string;
  date_range_start: string;
  date_range_end: string;
  /** The date of the event this is "before" or "after", when it's another entry. */
  anchor_date: string;
};

export type StoredDate = {
  date: string | null;
  date_precision: Precision;
  date_range_start: string | null;
  date_range_end: string | null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export const EMPTY_DATE_FORM: DateForm = {
  // Starts unset. Nothing is guessed on her behalf.
  date_precision: "unknown",
  date: "",
  approx_month: "",
  date_range_start: "",
  date_range_end: "",
  anchor_date: "",
};

/**
 * What to store. The precision always matches what was actually given: choosing "exact" without
 * entering a date stores "unknown", not an exact record with no date.
 */
export function resolveIncidentDate(f: DateForm): StoredDate {
  const none: StoredDate = { date: null, date_precision: "unknown", date_range_start: null, date_range_end: null };
  switch (f.date_precision) {
    case "exact":
      return DAY.test(f.date) ? { ...none, date: f.date, date_precision: "exact" } : none;
    case "approximate_month":
      return MONTH.test(f.approx_month)
        ? // A sort position only; the record is labelled approximate and shows the month, never a day.
          { ...none, date: `${f.approx_month}-15`, date_precision: "approximate_month" }
        : none;
    case "range": {
      const a = DAY.test(f.date_range_start) ? f.date_range_start : null;
      const b = DAY.test(f.date_range_end) ? f.date_range_end : null;
      if (!a && !b) return none;
      return { date: a ?? b, date_precision: "range", date_range_start: a, date_range_end: b };
    }
    case "before_anchor":
    case "after_anchor":
      return {
        ...none,
        date: DAY.test(f.anchor_date) ? f.anchor_date : null,
        date_precision: f.date_precision,
      };
    default:
      return none;
  }
}

/** Form values for editing a stored entry. An undated entry opens undated, not as today. */
export function dateFormFromRow(row: {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
}): DateForm {
  const known: Precision[] = ["exact", "approximate_month", "range", "before_anchor", "after_anchor", "unknown"];
  let p: Precision = known.includes(row.date_precision as Precision)
    ? (row.date_precision as Precision)
    : row.date
      ? "exact"
      : "unknown"; // older rows with no precision recorded
  if (p === "exact" && !row.date) p = "unknown";
  return {
    date_precision: p,
    date: p === "exact" ? (row.date ?? "") : "",
    approx_month: p === "approximate_month" && row.date ? row.date.slice(0, 7) : "",
    date_range_start: row.date_range_start ?? "",
    date_range_end: row.date_range_end ?? "",
    anchor_date: "",
  };
}

/** Short label for lists. Unknown reads as unknown. */
export function describeStoredDate(row: {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
}): string {
  const f = dateFormFromRow(row);
  const fmt = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[(m ?? 1) - 1]} ${dd}, ${y}`;
  };
  switch (f.date_precision) {
    case "exact":
      return fmt(f.date);
    case "approximate_month": {
      const [y, m] = f.approx_month.split("-").map(Number);
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return `Around ${months[(m ?? 1) - 1]} ${y}`;
    }
    case "range":
      return f.date_range_start && f.date_range_end
        ? `${fmt(f.date_range_start)} to ${fmt(f.date_range_end)}`
        : `Around ${fmt((f.date_range_start || f.date_range_end) as string)}`;
    case "before_anchor":
      return "Before another event";
    case "after_anchor":
      return "After another event";
    default:
      return "Date not added";
  }
}

/** A date picked from a calendar button, e.g. "Today". Always an explicit choice by the person. */
export function isoDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now.getTime() - days * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
