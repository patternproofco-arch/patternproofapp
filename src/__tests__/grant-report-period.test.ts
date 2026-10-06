import { describe, expect, it } from "vitest";
import {
  inPeriod,
  isValidTimeZone,
  localIsoDay,
  periodBounds,
  startOfDayMs,
} from "@/lib/grant-report-period";

describe("reporting period in a specified time zone", () => {
  it("UTC keeps the old behaviour: whole UTC days, inclusive", () => {
    const b = periodBounds("2026-01-01", "2026-06-30", "UTC");
    expect(new Date(b.startMs).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(new Date(b.endMs).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(inPeriod(b, "2026-06-30T23:59:59.999Z")).toBe(true);
    expect(inPeriod(b, "2026-07-01T00:00:00.000Z")).toBe(false);
  });

  it("Eastern days start at local midnight, across both DST changes", () => {
    // Jan 1 is EST (-05:00); Jul 1 is EDT (-04:00).
    const b = periodBounds("2026-01-01", "2026-06-30", "America/New_York");
    expect(new Date(b.startMs).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(new Date(b.endMs).toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(new Date(startOfDayMs("2026-03-08", "America/New_York")).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(new Date(startOfDayMs("2026-03-09", "America/New_York")).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(new Date(startOfDayMs("2026-11-02", "America/New_York")).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  it("9 pm Eastern on the last day is in the period; it would be out if read as UTC", () => {
    const late = "2026-07-01T01:00:00.000Z"; // Jun 30, 9:00 pm EDT
    expect(inPeriod(periodBounds("2026-04-01", "2026-06-30", "America/New_York"), late)).toBe(true);
    expect(inPeriod(periodBounds("2026-04-01", "2026-06-30", "UTC"), late)).toBe(false);
    expect(inPeriod(periodBounds("2026-07-01", "2026-09-30", "America/New_York"), late)).toBe(
      false,
    );
  });

  it("works for Pacific and for timestamps in Postgres' +00:00 format", () => {
    const b = periodBounds("2026-10-01", "2026-10-31", "America/Los_Angeles");
    expect(inPeriod(b, "2026-10-01T07:00:00+00:00")).toBe(true);
    expect(inPeriod(b, "2026-10-01T06:59:59.999999+00:00")).toBe(false);
    expect(inPeriod(b, "2026-11-01T06:59:59+00:00")).toBe(true);
    expect(inPeriod(b, "2026-11-01T07:00:00+00:00")).toBe(false);
  });

  it("missing or unreadable timestamps are never in the period", () => {
    const b = periodBounds("2026-01-01", "2026-12-31", "UTC");
    expect(inPeriod(b, null)).toBe(false);
    expect(inPeriod(b, undefined)).toBe(false);
    expect(inPeriod(b, "not a date")).toBe(false);
  });

  it("rejects a time zone the runtime can't use", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(() => periodBounds("2026-01-01", "2026-01-31", "Nope/Nowhere")).toThrow(/time zone/);
  });

  it("today's date comes from the local calendar, not UTC", () => {
    expect(localIsoDay(new Date(2026, 9, 6, 23, 30))).toBe("2026-10-06");
  });
});
