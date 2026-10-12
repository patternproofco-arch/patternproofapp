/**
 * Timezone-safe date helpers.
 *
 * `new Date("2026-05-21")` parses as UTC midnight, which renders as the
 * PREVIOUS calendar day in any timezone west of UTC. Always use these
 * helpers when displaying or comparing a YYYY-MM-DD string from the DB.
 */

import { describeReviewDate, isCalendarDay, type ReviewDateFields } from "@/lib/review-date-certainty";

/** Parse a calendar day locally; timestamps retain their intentional timezone semantics. */
export function parseDateLocal(dateStr: string | null | undefined): Date {
  if (typeof dateStr !== "string" || !dateStr.trim()) return new Date(NaN);
  // Accept either "YYYY-MM-DD" or full ISO; for ISO we trust the timestamp.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    if (!isCalendarDay(dateStr)) return new Date(NaN);
    const [y, m, d] = dateStr.split("-").map(Number);
    const local = new Date(0);
    local.setFullYear(y, m - 1, d);
    local.setHours(0, 0, 0, 0);
    return local;
  }
  return new Date(dateStr);
}

/** Format a YYYY-MM-DD string in the user's locale, timezone-safe. */
export function formatDateLocal(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
  fallback = "Date not documented",
  locale?: string,
): string {
  const date = parseDateLocal(dateStr);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString(locale, options);
}

/** A YYYY-MM heading is a calendar month, not UTC midnight on its first day. */
export function formatCalendarMonth(month: string | null | undefined): string {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "Date not documented";
  return formatDateLocal(`${month}-01`, { month: "long", year: "numeric" }, "Date not documented", "en-US");
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
export interface IncidentDateFields extends ReviewDateFields {}

export function formatIncidentDate(i: IncidentDateFields): string {
  const info = describeReviewDate(i);
  return info.certainty === "unknown" ? "Date not documented" : info.text;
}

/**
 * Evidence shares the incident date vocabulary, but its `date` may be absent
 * entirely — nothing in the app forces a date onto a piece of evidence.
 */
export function formatEvidenceDate(e: IncidentDateFields): string {
  return formatIncidentDate(e);
}

/**
 * Three-level confidence bucket driving the "thread" visual: taut/solid for
 * a confirmed date, slack/dashed for an anchored approximation, absent for
 * no date at all. Mirrors `formatIncidentDate`'s precision handling.
 */
export type DateConfidence = "confirmed" | "approximate" | "unknown";

export function dateConfidence(precision?: string | null): DateConfidence {
  const p = precision ?? "exact";
  if (p === "unknown") return "unknown";
  if (p === "exact") return "confirmed";
  return "approximate";
}
