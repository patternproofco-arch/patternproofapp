/**
 * Semantic timestamps.
 *
 * Gate 1 rule: every timestamp carries a TYPE, not merely a value. A screenshot
 * created on 9 September that shows a message sent on 14 August is an August
 * event. File creation, ingest, or upload time must never silently become the
 * event date.
 *
 * Nothing in this module guesses. It picks, from the typed candidates it is
 * given, the one that actually represents the event — and reports which kind it
 * used so the UI can say so out loud.
 */

export const TIMESTAMP_KINDS = [
  "message_sent_at",
  "email_date_header",
  "email_received_at",
  "photo_taken_at",
  "recording_created_at",
  "screenshot_created_at",
  "file_modified_at",
  "file_created_at",
  "survivor_confirmed_event_at",
  "ingested_at",
] as const;

export type TimestampKind = (typeof TIMESTAMP_KINDS)[number];

export function isTimestampKind(value: unknown): value is TimestampKind {
  return typeof value === "string" && (TIMESTAMP_KINDS as readonly string[]).includes(value);
}

export interface TypedTimestamp {
  kind: TimestampKind;
  /** ISO date or datetime string. */
  value: string;
}

/**
 * Kinds that describe when the underlying EVENT happened, as opposed to when a
 * file about the event was made or handled. Only these may set an event date.
 */
export const EVENT_BEARING_KINDS: readonly TimestampKind[] = [
  "survivor_confirmed_event_at",
  "message_sent_at",
  "email_date_header",
  "email_received_at",
  "photo_taken_at",
  "recording_created_at",
];

/**
 * Kinds that describe the FILE, not the event. Useful context, never a silent
 * event date.
 */
export const FILE_BEARING_KINDS: readonly TimestampKind[] = [
  "screenshot_created_at",
  "file_modified_at",
  "file_created_at",
  "ingested_at",
];

export function isEventBearing(kind: TimestampKind): boolean {
  return EVENT_BEARING_KINDS.includes(kind);
}

/**
 * Precedence, strongest first. A human confirmation always wins; after that the
 * timestamp closest to the event itself wins. File-level timestamps are absent
 * on purpose — see `resolveEventTimestamp`.
 */
const EVENT_PRECEDENCE: readonly TimestampKind[] = [
  "survivor_confirmed_event_at",
  "message_sent_at",
  "email_date_header",
  "email_received_at",
  "photo_taken_at",
  "recording_created_at",
];

export interface ResolvedEventTimestamp {
  /** null when nothing present actually describes the event. */
  resolved: TypedTimestamp | null;
  /** Every candidate kept, so the record can show its provenance. */
  candidates: TypedTimestamp[];
  /** Human-readable note about which timestamp was used and why. */
  note: string;
}

export const NO_EVENT_DATE_NOTE =
  "No date in this material describes when the event happened. File dates were not used as the event date.";

export function timestampKindLabel(kind: TimestampKind): string {
  switch (kind) {
    case "message_sent_at":
      return "message sent";
    case "email_date_header":
      return "email date header";
    case "email_received_at":
      return "email received";
    case "photo_taken_at":
      return "photo taken";
    case "recording_created_at":
      return "recording made";
    case "screenshot_created_at":
      return "screenshot created";
    case "file_modified_at":
      return "file last changed";
    case "file_created_at":
      return "file created";
    case "survivor_confirmed_event_at":
      return "you confirmed this date";
    case "ingested_at":
      return "added to PatternProof";
  }
}

/**
 * Choose the timestamp that represents the event. Returns null (with a plain
 * explanation) rather than falling back to a file timestamp.
 */
export function resolveEventTimestamp(
  candidates: Array<TypedTimestamp | null | undefined>,
): ResolvedEventTimestamp {
  const kept = candidates.filter(
    (c): c is TypedTimestamp => !!c && typeof c.value === "string" && c.value.trim().length > 0,
  );
  for (const kind of EVENT_PRECEDENCE) {
    const hit = kept.find((c) => c.kind === kind);
    if (hit) {
      return {
        resolved: hit,
        candidates: kept,
        note: `Ordered by ${timestampKindLabel(kind)}.`,
      };
    }
  }
  return { resolved: null, candidates: kept, note: NO_EVENT_DATE_NOTE };
}

/** Sort key for chronology. Records without an event date sort last. */
export function chronologySortKey(resolved: ResolvedEventTimestamp): string | null {
  return resolved.resolved?.value ?? null;
}

/**
 * Where a record belongs in review. Nothing is ever guessed: a record with no
 * event-bearing date needs one from the person, and two event-bearing dates
 * that fall on different days are a conflict for the person to settle.
 */
export type DateReviewBucket = "dated" | "needs_date" | "date_conflict";

const DAY = (iso: string) => iso.slice(0, 10);

export function dateReviewBucket(resolved: ResolvedEventTimestamp): DateReviewBucket {
  if (!resolved.resolved) return "needs_date";
  // A date the person confirmed themselves settles the question.
  if (resolved.resolved.kind === "survivor_confirmed_event_at") return "dated";
  const days = new Set(
    resolved.candidates.filter((c) => isEventBearing(c.kind)).map((c) => DAY(c.value)),
  );
  return days.size > 1 ? "date_conflict" : "dated";
}
