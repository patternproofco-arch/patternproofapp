import { describe, expect, it } from "vitest";
import { formatDateLocal, formatIncidentDate, formatMonthKey, parseDateLocal } from "@/lib/dates";

// The attorney timeline used `new Date("2025-08-14")`, which is UTC midnight and shows as the
// day before in any US timezone. Month headings used `new Date("2026-03-01")` and showed the
// month before. Entries with no date were grouped under "0000-00" and rendered "Invalid Date".
// These tests pin the calendar date the survivor typed, whatever timezone the viewer is in.

describe("attorney timeline dates show the calendar date that was stored", () => {
  it("a stored day shows as that same day, not the day before", () => {
    expect(formatDateLocal("2025-08-14")).toBe("Aug 14, 2025");
    expect(formatDateLocal("2025-09-20")).toBe("Sep 20, 2025");
    expect(formatDateLocal("2025-10-03")).toBe("Oct 3, 2025");
    expect(parseDateLocal("2025-10-03").getDate()).toBe(3);
  });

  it("an exact entry is labelled with its own date", () => {
    expect(formatIncidentDate({ date: "2025-08-14", date_precision: "exact" })).toBe(
      "Aug 14, 2025",
    );
    expect(formatIncidentDate({ date: "2025-08-14" })).toBe("Aug 14, 2025");
  });

  it("an entry whose date was not known reads 'Date not documented'", () => {
    expect(formatIncidentDate({ date: null, date_precision: "unknown" })).toBe(
      "Date not documented",
    );
    expect(formatIncidentDate({ date: null })).toBe("Date not documented");
  });

  it("an approximate entry never shows the sort-helper day", () => {
    const label = formatIncidentDate({ date: "2025-09-15", date_precision: "approximate_month" });
    expect(label).toBe("September 2025 (approximate)");
    expect(label).not.toMatch(/15/);
  });
});

describe("month headings", () => {
  it("name the month the entries belong to, not the month before", () => {
    expect(formatMonthKey("2026-03")).toBe("March 2026");
    expect(formatMonthKey("2025-09")).toBe("September 2025");
    expect(formatMonthKey("2025-01")).toBe("January 2025");
    expect(formatMonthKey("2025-12")).toBe("December 2025");
  });

  it("the no-date bucket is labelled, never 'Invalid Date'", () => {
    expect(formatMonthKey("0000-00")).toBe("Date not documented");
    expect(formatMonthKey("Undated")).toBe("Date not documented");
    expect(formatMonthKey("")).toBe("Date not documented");
    expect(formatMonthKey("2025-13")).toBe("Date not documented");
    expect(formatMonthKey("0000-00")).not.toMatch(/invalid/i);
  });

  it("month grouping keys derived from a stored day agree with the heading", () => {
    for (const day of ["2026-03-11", "2025-11-14", "2025-08-31", "2026-01-01"]) {
      const key = day.slice(0, 7);
      expect(formatMonthKey(key)).toBe(
        parseDateLocal(day).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      );
    }
  });
});
