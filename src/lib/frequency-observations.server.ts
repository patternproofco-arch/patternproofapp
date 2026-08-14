import { ABUSE_TYPES } from "@/lib/abuse-types";

/**
 * Neutral frequency observations.
 *
 * Deterministic counts only. No AI, no scoring, no interpretation.
 * Every observation string is built by `phrase()` and nothing else — this is
 * the single enforcement point for the rule that an observation may only ever
 * say "{count} {event label} {timeframe}".
 */
export function phrase(count: number, eventLabel: string, timeframe: string): string {
  return `${count} ${eventLabel} ${timeframe}`;
}

export type ObservationSource =
  | "incidents"
  | "communications"
  | "thread_messages"
  | "court_dates"
  | "evidence";

export interface ObservationSourceRow {
  id: string;
  /** A bare date string. Never a characterization. */
  label: string;
}

export interface FrequencyObservation {
  id: string;
  count: number;
  eventLabel: string;
  timeframe: string;
  text: string;
  source: ObservationSource;
  href: string;
  rows: ObservationSourceRow[];
}

const HREF: Record<ObservationSource, string> = {
  incidents: "/journal",
  communications: "/communications",
  thread_messages: "/message-threads",
  court_dates: "/court-dates",
  evidence: "/evidence",
};

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function daysAgoDate(days: number): string {
  return daysAgoIso(days).slice(0, 10);
}

export function quarterStartDate(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), q, 1)).toISOString().slice(0, 10);
}

export function monthStartDate(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function abuseTypeLabel(value: string): string {
  const found = ABUSE_TYPES.find((t) => t.value === value);
  return (found?.label ?? value.replace(/_/g, " ")).toLowerCase();
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "no date recorded";
  return value.length > 10 ? value.slice(0, 10) : value;
}

/** Observations below this count are not surfaced at all. */
export const MIN_COUNT = 2;

export function buildObservation(
  id: string,
  source: ObservationSource,
  eventLabel: string,
  timeframe: string,
  rows: ObservationSourceRow[],
): FrequencyObservation | null {
  if (rows.length < MIN_COUNT) return null;
  return {
    id,
    count: rows.length,
    eventLabel,
    timeframe,
    text: phrase(rows.length, eventLabel, timeframe),
    source,
    href: HREF[source],
    rows,
  };
}
