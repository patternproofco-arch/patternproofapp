import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dateReviewBucket, resolveEventTimestamp } from "@/lib/timestamps";

describe("date review buckets", () => {
  it("sends a record with no event-bearing date to Needs a date", () => {
    const r = resolveEventTimestamp([
      { kind: "file_created_at", value: "2026-09-09" },
      { kind: "ingested_at", value: "2026-09-10" },
    ]);
    expect(dateReviewBucket(r)).toBe("needs_date");
  });

  it("flags two event-bearing dates on different days as a conflict", () => {
    const r = resolveEventTimestamp([
      { kind: "message_sent_at", value: "2026-08-14" },
      { kind: "photo_taken_at", value: "2026-08-16" },
    ]);
    expect(dateReviewBucket(r)).toBe("date_conflict");
  });

  it("treats a person's own confirmed date as settled", () => {
    const r = resolveEventTimestamp([
      { kind: "survivor_confirmed_event_at", value: "2026-08-14" },
      { kind: "photo_taken_at", value: "2026-08-16" },
    ]);
    expect(dateReviewBucket(r)).toBe("dated");
  });

  it("does not flag the same day reported by two sources", () => {
    const r = resolveEventTimestamp([
      { kind: "message_sent_at", value: "2026-08-14T09:00:00Z" },
      { kind: "photo_taken_at", value: "2026-08-14T21:30:00Z" },
    ]);
    expect(dateReviewBucket(r)).toBe("dated");
  });
});

describe("the model is not allowed to order the timeline", () => {
  const prompt = readFileSync("src/lib/propose-timeline.functions.ts", "utf8");

  it("no longer asks for a best relative order", () => {
    expect(prompt).not.toContain("best relative order");
  });

  it("states plainly that ordering is computed in code", () => {
    expect(prompt).toContain("YOU DO NOT DECIDE THE ORDER");
  });

  it("keeps file dates out of event dates", () => {
    expect(prompt).toContain("NEVER the event date");
  });
});
