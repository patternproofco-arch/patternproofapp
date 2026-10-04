import { describe, expect, it } from "vitest";
import {
  EMPTY_DATE_FORM,
  dateFormFromRow,
  describeStoredDate,
  isoDaysAgo,
  resolveIncidentDate,
  type DateForm,
} from "@/lib/incident-date";

const form = (o: Partial<DateForm>): DateForm => ({ ...EMPTY_DATE_FORM, ...o });

describe("an unknown date stays unknown", () => {
  it("a new entry starts with no date, not today and not 'exact'", () => {
    expect(EMPTY_DATE_FORM.date).toBe("");
    expect(EMPTY_DATE_FORM.date_precision).toBe("unknown");
    expect(resolveIncidentDate(EMPTY_DATE_FORM)).toEqual({
      date: null,
      date_precision: "unknown",
      date_range_start: null,
      date_range_end: null,
    });
  });

  it("'exact' with no date is stored as unknown, never as an exact record with no date", () => {
    expect(resolveIncidentDate(form({ date_precision: "exact", date: "" }))).toMatchObject({
      date: null,
      date_precision: "unknown",
    });
    expect(resolveIncidentDate(form({ date_precision: "exact", date: "not a date" }))).toMatchObject({
      date: null,
      date_precision: "unknown",
    });
  });

  it("approximate month and range without their values are unknown too", () => {
    expect(resolveIncidentDate(form({ date_precision: "approximate_month" })).date_precision).toBe("unknown");
    expect(resolveIncidentDate(form({ date_precision: "range" })).date_precision).toBe("unknown");
  });

  it("a date she gives is kept exactly", () => {
    expect(resolveIncidentDate(form({ date_precision: "exact", date: "2026-03-03" }))).toEqual({
      date: "2026-03-03",
      date_precision: "exact",
      date_range_start: null,
      date_range_end: null,
    });
  });

  it("an approximate month is labelled approximate and keeps no day of its own", () => {
    const r = resolveIncidentDate(form({ date_precision: "approximate_month", approx_month: "2026-03" }));
    expect(r.date_precision).toBe("approximate_month");
    expect(describeStoredDate(r)).toBe("Around March 2026");
  });

  it("ranges keep both ends, or the one given", () => {
    expect(resolveIncidentDate(form({ date_precision: "range", date_range_start: "2026-03-01", date_range_end: "2026-03-09" }))).toMatchObject({
      date_range_start: "2026-03-01",
      date_range_end: "2026-03-09",
    });
    expect(resolveIncidentDate(form({ date_precision: "range", date_range_end: "2026-03-09" }))).toMatchObject({
      date_range_start: null,
      date_range_end: "2026-03-09",
    });
  });

  it("before/after another event with no calendar date stays undated but keeps its meaning", () => {
    expect(resolveIncidentDate(form({ date_precision: "before_anchor" }))).toMatchObject({ date: null, date_precision: "before_anchor" });
  });

  it("fields that don't belong to the chosen kind of date are not carried over", () => {
    const r = resolveIncidentDate(form({ date_precision: "exact", date: "2026-03-03", date_range_start: "2025-01-01", approx_month: "2024-02" }));
    expect(r.date_range_start).toBeNull();
    expect(r.date).toBe("2026-03-03");
  });
});

describe("editing never invents a date", () => {
  it("an undated entry opens undated (it used to open as today and save as today)", () => {
    expect(dateFormFromRow({ date: null, date_precision: "unknown" })).toMatchObject({ date_precision: "unknown", date: "" });
    expect(dateFormFromRow({ date: null, date_precision: null })).toMatchObject({ date_precision: "unknown", date: "" });
    expect(dateFormFromRow({ date: null, date_precision: "exact" })).toMatchObject({ date_precision: "unknown", date: "" });
  });

  it("an older row with a date and no precision reads as exact", () => {
    expect(dateFormFromRow({ date: "2026-03-03", date_precision: null })).toMatchObject({ date_precision: "exact", date: "2026-03-03" });
  });

  it("saving an untouched undated entry keeps it undated", () => {
    const r = resolveIncidentDate(dateFormFromRow({ date: null, date_precision: "unknown" }));
    expect(r.date).toBeNull();
    expect(r.date_precision).toBe("unknown");
  });

  it("round-trips approximate and range entries", () => {
    const approx = resolveIncidentDate(dateFormFromRow({ date: "2026-03-15", date_precision: "approximate_month" }));
    expect(approx).toMatchObject({ date: "2026-03-15", date_precision: "approximate_month" });
    const range = resolveIncidentDate(
      dateFormFromRow({ date: "2026-03-01", date_precision: "range", date_range_start: "2026-03-01", date_range_end: "2026-03-09" }),
    );
    expect(range.date_range_end).toBe("2026-03-09");
  });
});

describe("labels", () => {
  it("says 'Date not added' for an undated entry", () => {
    expect(describeStoredDate({ date: null, date_precision: "unknown" })).toBe("Date not added");
    expect(describeStoredDate({ date: null })).toBe("Date not added");
  });
  it("one-tap dates are explicit choices computed from the clock", () => {
    const now = new Date(2026, 2, 3, 12);
    expect(isoDaysAgo(0, now)).toBe("2026-03-03");
    expect(isoDaysAgo(1, now)).toBe("2026-03-02");
  });
});
