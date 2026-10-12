import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BinderExhibits } from "@/components/BinderExhibits";
import { buildBinderEntries, formatBinderDate, type BinderEntry } from "@/lib/binder";
import { buildPleadingText } from "@/lib/pleading";
import { formatCalendarMonth, formatDateLocal, formatEvidenceDate, formatIncidentDate, parseDateLocal } from "@/lib/dates";
import { describeReviewDate, isCalendarDay } from "@/lib/review-date-certainty";
import { buildExhibitBinderZip } from "@/lib/binder-zip.server";
import JSZip from "jszip";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const fixtures = [
  { id: "exact", date: "2026-03-12", date_precision: "exact" },
  { id: "approx", date: "2025-11-15", date_precision: "approximate_month" },
  { id: "legacy-approx", date: "2025-11-15", date_precision: "approximate" },
  { id: "range", date: "2026-03-01", date_precision: "range", date_range_start: "2026-03-01", date_range_end: "2026-03-09" },
  { id: "start-only", date: "2026-03-01", date_precision: "range", date_range_start: "2026-03-01" },
  { id: "end-only", date: "2026-03-09", date_precision: "range", date_range_end: "2026-03-09" },
  { id: "before", date: "2026-03-12", date_precision: "before_anchor", anchor_label: "the school meeting" },
  { id: "after", date: "2026-03-12", date_precision: "after_anchor", anchor_label: "the move" },
  { id: "unknown", date: "2026-03-12", date_precision: "unknown" },
  { id: "null", date: null },
];

describe.each(["America/New_York", "America/Los_Angeles", "UTC", "Asia/Tokyo"])("review date accuracy in %s", (tz) => {
  it("keeps calendar days and month headings stable, including DST boundaries", () => {
    process.env.TZ = tz;
    const offsets: Record<string, number> = { "America/New_York": 240, "America/Los_Angeles": 420, UTC: 0, "Asia/Tokyo": -540 };
    // Confirm the runtime really changed timezone; otherwise a matrix could pass in UTC only.
    expect(new Date("2026-03-12T12:00:00Z").getTimezoneOffset()).toBe(offsets[tz]);
    for (const day of ["2026-03-08", "2026-03-12", "2026-11-01", "2026-11-02"]) {
      expect(formatDateLocal(day, { year: "numeric", month: "2-digit", day: "2-digit" }, "missing", "en-US"))
        .toBe(`${day.slice(5, 7)}/${day.slice(8, 10)}/${day.slice(0, 4)}`);
    }
    expect(formatCalendarMonth("2026-03")).toBe("March 2026");
    expect(formatCalendarMonth("2025-11")).toBe("November 2025");
    expect(formatCalendarMonth("2025-08")).toBe("August 2025");
  });

  it("never coerces missing/invalid event dates to epoch or another valid day", () => {
    process.env.TZ = tz;
    for (const value of [null, undefined, "", "not-a-date", "2026-02-30", "2026-13-01"]) {
      expect(formatDateLocal(value)).toBe("Date not documented");
      expect(Number.isNaN(parseDateLocal(value).getTime())).toBe(true);
      expect(formatEvidenceDate({ date: value })).toBe("Date not documented");
    }
    expect(formatCalendarMonth("2026-13")).toBe("Date not documented");
  });

  it("preserves exact/approximate/range/anchor/unknown certainty in cards and copied prose", () => {
    process.env.TZ = tz;
    const entries = buildBinderEntries(fixtures.map((f) => ({ ...f, title: f.id, description: "Client words" })), [], []);
    const byId = new Map(entries.map((e) => [e.id, e]));
    expect(formatBinderDate(byId.get("exact")!)).toBe("March 12, 2026");
    expect(formatBinderDate(byId.get("approx")!)).toBe("November 2025 (approximate; exact day not known)");
    expect(byId.get("approx")!.dateInfo!.precision).toBe("approximate_month");
    expect(byId.get("legacy-approx")!.dateInfo!.precision).toBe("approximate");
    expect(formatBinderDate(byId.get("range")!)).toContain("Between March 1, 2026 and March 9, 2026");
    expect(formatBinderDate(byId.get("start-only")!)).toContain("On or after March 1, 2026");
    expect(formatBinderDate(byId.get("end-only")!)).toContain("On or before March 9, 2026");
    expect(formatBinderDate(byId.get("before")!)).toContain("Before the school meeting");
    expect(formatBinderDate(byId.get("after")!)).toContain("After the move");
    expect(byId.get("before")!.sortDate).toBeNull();
    expect(byId.get("unknown")!.sortDate).toBeNull();
    expect(byId.get("range")!.date_range_end).toBe("2026-03-09");
    expect(byId.get("before")!.anchor_label).toBe("the school meeting");
    const prose = buildPleadingText(entries);
    const cards = renderToStaticMarkup(<BinderExhibits entries={entries} />);
    expect(prose).toContain("In or around November 2025");
    expect(prose).toContain("Sometime between March 1, 2026 and March 9, 2026");
    expect(prose).toContain("Before the school meeting");
    expect(prose).toContain("After the move");
    expect(prose).toContain("On a date the client did not record");
    for (const output of [prose, cards]) {
      expect(output).not.toContain("November 15");
      expect(output).not.toContain("2025-11-15");
      expect(output).not.toContain("Date not given");
    }
    expect(formatIncidentDate(fixtures[1])).toContain("exact day not known");
  });

  it("never substitutes upload or metadata timestamps for an evidence event date", () => {
    process.env.TZ = tz;
    const entries = buildBinderEntries([], [{ id: "file", title: "Undated file", date: null, created_at: "2026-07-22T00:00:00Z", event_at: "2026-07-21T00:00:00Z" }], []);
    expect(entries[0].date).toBeNull();
    expect(entries[0].sortDate).toBeNull();
    expect(formatBinderDate(entries[0])).toBe("Date not known");
    const prose = buildPleadingText(entries);
    expect(prose).toContain("Recorded event timing: Date not known");
    expect(prose).not.toMatch(/July|2026-07|uploaded|1969|1970/);
  });

  it("labels request submission timing separately and retains timestamp semantics", () => {
    process.env.TZ = tz;
    const entries = buildBinderEntries([], [], [{ id: "answer", status: "submitted", title: "Answer", submitted_at: "2026-03-12T23:00:00Z" }]);
    expect(formatBinderDate(entries[0])).toBe("Request submitted: March 12, 2026");
    expect(buildPleadingText(entries)).toContain("request submission date, not an event date");
    expect(parseDateLocal("2026-03-12T23:00:00Z").getTime()).toBe(Date.parse("2026-03-12T23:00:00Z"));
  });
});

describe("legacy compatibility and invalid certainty guard", () => {
  it("remains compatible with the actual binder ZIP builder and its copied chronology", async () => {
    const entries = buildBinderEntries([fixtures[1]], [{ id: "file", date: null, title: "File", created_at: "2026-07-22T00:00:00Z" }], []);
    const built = await buildExhibitBinderZip({ entries, clientRef: "date-test", generatedAt: "2026-10-11T12:00:00Z" });
    expect(built.exhibitCount).toBe(2);
    const zip = await JSZip.loadAsync(built.zipBuf);
    const chronology = await zip.file("factual-chronology.txt")!.async("string");
    expect(chronology).toContain("In or around November 2025");
    expect(chronology).toContain("Recorded event timing: Date not known");
    expect(chronology).not.toContain("November 15");
    expect(chronology).not.toContain("July 22");
  });
  it("accepts legacy BinderEntry values without new required fields", () => {
    const entry: BinderEntry = { id: "legacy", kind: "incident", label: "Entry", exhibit: "Exhibit 1", date: "2026-03-12", title: "Legacy", body: null };
    expect(formatBinderDate(entry)).toBe("March 12, 2026");
    expect(buildPleadingText([entry])).toContain("On March 12, 2026");
  });
  it("does not promote malformed range/approximate/unsupported precision to an exact date", () => {
    for (const precision of ["range", "future_precision"]) {
      expect(describeReviewDate({ date: "2026-03-12", date_precision: precision }).certainty).toBe("unknown");
    }
    expect(describeReviewDate({ date: "bad", date_precision: "approximate_month" }).certainty).toBe("unknown");
    expect(describeReviewDate({ date_precision: "after_anchor", anchor_incident: { description: "another recorded event" } }).lead).toBe("After another recorded event");
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("2025-02-29")).toBe(false);
  });
  it("preserves frozen exhibit numbers despite certainty-aware ordering", () => {
    const entries = buildBinderEntries(fixtures, [], [], new Map([["incident:before", "Exhibit 42"]]));
    expect(entries.find((e) => e.id === "before")!.exhibit).toBe("Exhibit 42");
    expect(entries.find((e) => e.id === "exact")!.exhibit).toBe("Not yet numbered");
  });
});
