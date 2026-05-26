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