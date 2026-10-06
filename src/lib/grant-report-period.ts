/**
 * Grant report — reporting period in a specified time zone (pure, no I/O).
 *
 * A funder period like "Jan 1 – Jun 30" means calendar days where the program
 * works, not UTC days. A follow-up completed at 9 pm Eastern on Jun 30 is in the
 * period; reading the period as UTC days would push it into July.
 *
 * Every report stores the IANA time zone its period was read in (e.g.
 * "America/New_York"). Bounds are [start of first day, start of the day after the
 * last day) in that zone, compared as instants, so DST changes inside the period
 * are handled and nothing depends on how a timestamp string happens to be formatted.
 */

export const DEFAULT_PERIOD_TIMEZONE = "UTC";

/** True for a time zone the runtime can actually use. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (east positive). */
function offsetMs(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function parseDay(day: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error("Choose a reporting period.");
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** The instant a calendar day starts in `tz` (00:00 local, or the first valid time after it). */
export function startOfDayMs(day: string, tz: string): number {
  const [y, mo, d] = parseDay(day);
  const wall = Date.UTC(y, mo - 1, d);
  // Two passes settle the offset across a DST change at or near midnight.
  let guess = wall - offsetMs(wall, tz);
  guess = wall - offsetMs(guess, tz);
  return guess;
}

function nextDay(day: string): string {
  const [y, mo, d] = parseDay(day);
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
}

export type PeriodBounds = {
  /** First instant in the period. */
  startMs: number;
  /** First instant after the period (exclusive). */
  endMs: number;
  timeZone: string;
};

export function periodBounds(
  from: string,
  to: string,
  timeZone: string = DEFAULT_PERIOD_TIMEZONE,
): PeriodBounds {
  if (!isValidTimeZone(timeZone))
    throw new Error("Choose a valid time zone for the reporting period.");
  return {
    startMs: startOfDayMs(from, timeZone),
    endMs: startOfDayMs(nextDay(to), timeZone),
    timeZone,
  };
}

/** Whether a stored timestamp falls inside the period. Missing or unreadable = no. */
export function inPeriod(bounds: PeriodBounds, iso: string | null | undefined): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= bounds.startMs && ms < bounds.endMs;
}

/** Today's date (YYYY-MM-DD) on the user's own calendar, not UTC's. */
export function localIsoDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The browser's own zone, falling back to UTC if it can't be read. */
export function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : DEFAULT_PERIOD_TIMEZONE;
  } catch {
    return DEFAULT_PERIOD_TIMEZONE;
  }
}
