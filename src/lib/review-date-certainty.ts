/** Date presentation guard for legacy binder/UI consumers. No record is changed. */
import { describeDate, type DateInfo } from "@/lib/chronology";

export interface ReviewDateFields {
  date?: string | null;
  date_precision?: string | null;
  date_range_start?: string | null;
  date_range_end?: string | null;
  anchor_label?: string | null;
  anchor_incident?: { date?: string | null; description?: string | null } | null;
}

/** Validate calendar components without interpreting them as an instant. */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const check = new Date(0);
  check.setUTCFullYear(y, m - 1, d);
  check.setUTCHours(0, 0, 0, 0);
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

/** Preserve the stored precision variant as well as chronology's broader certainty bucket. */
export type ReviewDateInfo = DateInfo & { precision: string };

const unknownDate = (): ReviewDateInfo => ({ ...describeDate({ date_precision: "unknown" }), precision: "unknown" });

/** Reuse chronology wording, but never let malformed/unsupported precision fall through to exact. */
export function describeReviewDate(row: ReviewDateFields): ReviewDateInfo {
  const p = row.date_precision ?? "exact";
  const date = isCalendarDay(row.date) ? row.date : null;
  const start = isCalendarDay(row.date_range_start) ? row.date_range_start : null;
  const end = isCalendarDay(row.date_range_end) ? row.date_range_end : null;
  const anchor = row.anchor_label?.trim() || row.anchor_incident?.description?.trim() || null;
  if (p === "exact" && !date) return unknownDate();
  if ((p === "approximate_month" || p === "approximate") && !date && !start) return unknownDate();
  if (p === "range" && !start && !end) return unknownDate();
  if (!["exact", "approximate_month", "approximate", "range", "before_anchor", "after_anchor", "unknown"].includes(p)) {
    return unknownDate();
  }
  return { ...describeDate({ date, date_precision: p, date_range_start: start, date_range_end: end, anchor_label: anchor }), precision: p };
}
