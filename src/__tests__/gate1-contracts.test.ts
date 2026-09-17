import { describe, expect, it } from "vitest";
import {
  NO_EVENT_DATE_NOTE,
  isEventBearing,
  isTimestampKind,
  resolveEventTimestamp,
  timestampKindLabel,
} from "@/lib/timestamps";
import {
  buildObservation,
  UNIT_BY_SOURCE,
  type ObservationSourceRow,
} from "@/lib/frequency-observations.server";
import { NO_EVENT_PROPOSED } from "@/lib/propose-timeline.functions";

describe("typed timestamps", () => {
  it("orders a screenshot by the message it shows, not by when it was made", () => {
    const r = resolveEventTimestamp([
      { kind: "screenshot_created_at", value: "2026-09-09" },
      { kind: "message_sent_at", value: "2026-08-14" },
    ]);
    expect(r.resolved).toEqual({ kind: "message_sent_at", value: "2026-08-14" });
    expect(r.note).toContain("message sent");
  });

  it("never lets a file or upload date become the event date", () => {
    const r = resolveEventTimestamp([
      { kind: "file_created_at", value: "2026-09-09" },
      { kind: "ingested_at", value: "2026-09-10" },
      { kind: "file_modified_at", value: "2026-09-11" },
    ]);
    expect(r.resolved).toBeNull();
    expect(r.note).toBe(NO_EVENT_DATE_NOTE);
    expect(r.candidates).toHaveLength(3);
  });

  it("prefers a survivor's own confirmation over any extracted date", () => {
    const r = resolveEventTimestamp([
      { kind: "photo_taken_at", value: "2026-05-01" },
      { kind: "survivor_confirmed_event_at", value: "2026-04-28" },
    ]);
    expect(r.resolved?.kind).toBe("survivor_confirmed_event_at");
  });

  it("classifies file-level kinds as not event-bearing", () => {
    expect(isEventBearing("photo_taken_at")).toBe(true);
    expect(isEventBearing("screenshot_created_at")).toBe(false);
    expect(isEventBearing("ingested_at")).toBe(false);
  });

  it("validates and labels kinds in plain language", () => {
    expect(isTimestampKind("message_sent_at")).toBe(true);
    expect(isTimestampKind("whenever")).toBe(false);
    expect(timestampKindLabel("email_date_header")).toBe("email date header");
  });
});

describe("recurrence counts events, not supporting files", () => {
  const rows = (ids: string[]): ObservationSourceRow[] =>
    ids.map((id) => ({ id, label: "2026-08-14" }));

  it("counts one confirmed event once no matter how much evidence backs it", () => {
    // Same incident id contributed by 12 screenshots + a recording + a PDF.
    const o = buildObservation(
      "incidents:emotional",
      "incidents",
      "Marks logged under emotional",
      "in the past 30 days",
      rows(["inc-1", "inc-1", "inc-1", "inc-1", "inc-2"]),
    );
    expect(o?.count).toBe(2);
    expect(o?.unit).toBe("event");
    expect(o?.text).toBe("2 Marks logged under emotional in the past 30 days");
  });

  it("labels message and file counts so they cannot read as events", () => {
    const msgs = buildObservation(
      "thread_messages:flagged",
      "thread_messages",
      "imported items carrying a marker",
      "in the past 14 days",
      rows(["m1", "m2", "m3"]),
    );
    expect(msgs?.unit).toBe("message");
    expect(msgs?.eventLabel).toContain("messages");

    const files = buildObservation(
      "evidence:month",
      "evidence",
      "items added",
      "this month",
      rows(["e1", "e2"]),
    );
    expect(files?.unit).toBe("file");
    expect(files?.eventLabel).toContain("evidence files");
  });

  it("maps every source to an explicit unit", () => {
    expect(UNIT_BY_SOURCE.incidents).toBe("event");
    expect(UNIT_BY_SOURCE.evidence).toBe("file");
    expect(UNIT_BY_SOURCE.communications).toBe("message");
  });

  it("still suppresses single occurrences", () => {
    expect(
      buildObservation("incidents:x", "incidents", "Marks", "this month", rows(["a", "a"])),
    ).toBeNull();
  });
});

describe("no forced timeline events", () => {
  it("states plainly when evidence supports no event", () => {
    expect(NO_EVENT_PROPOSED).toBe("No timeline event proposed.");
  });
});
