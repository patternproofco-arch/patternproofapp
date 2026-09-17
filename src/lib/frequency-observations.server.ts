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
  "incidents" | "communications" | "thread_messages" | "court_dates" | "evidence";

/**
 * What is being counted. Recurrence of what happened is ONLY ever "event".
 * Supporting material is counted separately and always labelled as such, so a
 * single confirmed event backed by 12 screenshots and 40 messages can never
 * read as 52 events.
 */
export type ObservationUnit = "event" | "message" | "file";

export const UNIT_BY_SOURCE: Record<ObservationSource, ObservationUnit> = {
  incidents: "event",
  communications: "message",
  thread_messages: "message",
  court_dates: "event",
  evidence: "file",
};

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
  unit: ObservationUnit;
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
  // One row per THING COUNTED. Callers must pass one row per confirmed event
  // when the unit is "event"; duplicates by id are collapsed here so that
  // several files attached to one event can never inflate the count.
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  if (unique.length < MIN_COUNT) return null;
  const unit = UNIT_BY_SOURCE[source];
  // Supporting material is always named out loud, never left to read as events.
  const label =
    unit === "message" && !/message/i.test(eventLabel)
      ? `${eventLabel} (messages)`
      : unit === "file" && !/file/i.test(eventLabel)
        ? `${eventLabel} (evidence files)`
        : eventLabel;
  return {
    id,
    count: unique.length,
    eventLabel: label,
    timeframe,
    text: phrase(unique.length, label, timeframe),
    source,
    unit,
    href: HREF[source],
    rows: unique,
  };
}
