import { describe, expect, it } from "vitest";
import { bucket, type GrantReport } from "@/lib/org-grant-report.functions";
import {
  DV_FUNDER_CATEGORY_SPECS,
  dvCategoriesToCsvRows,
  formatDvCategoryValue,
  mapGrantReportToDvCategories,
} from "@/lib/org-grant-report-categories";

function sample(over: Partial<GrantReport> = {}): Omit<GrantReport, "dv_categories"> {
  return {
    org_name: "Harbor Legal Group",
    from: "2026-01-01",
    to: "2026-06-30",
    time_zone: "UTC",
    people_served: bucket(12),
    cases_opened: bucket(8),
    cases_closed: bucket(3),
    cases_active_end: bucket(6),
    follow_ups_created: bucket(15),
    follow_ups_completed: bucket(10),
    referrals: bucket(2),
    avg_days_to_first_follow_up: 4.5,
    advocates: 7,
    ...over,
  };
}

describe("org grant DV funder categories", () => {
  it("exposes VOCA, VAWA, FVPSA, and STOP program labels funders recognize", () => {
    const programs = new Set(DV_FUNDER_CATEGORY_SPECS.map((s) => s.funder_program));
    expect(programs.has("VOCA")).toBe(true);
    expect(programs.has("VAWA")).toBe(true);
    expect(programs.has("FVPSA")).toBe(true);
    expect(programs.has("STOP")).toBe(true);
    expect(programs.has("Cross-cutting")).toBe(true);
  });

  it("maps people_served into VOCA / VAWA / STOP victims-served rows", () => {
    const rows = mapGrantReportToDvCategories(sample());
    const victims = rows.filter((r) =>
      ["voca_victims_served", "vawa_victims_served", "stop_victims_served"].includes(r.id),
    );
    expect(victims).toHaveLength(3);
    for (const r of victims) {
      expect(r.value).toBe(12);
      expect(r.source_metric).toBe("people_served");
      expect(r.note.toLowerCase()).toMatch(/not a certified program outcome/);
    }
  });

  it("preserves fewer-than-5 bucketing on mapped category values", () => {
    const rows = mapGrantReportToDvCategories(
      sample({
        cases_closed: bucket(3),
        referrals: bucket(4),
        people_served: bucket(1),
      }),
    );
    expect(rows.find((r) => r.id === "vawa_cases_closed")?.value).toBe("fewer than 5");
    expect(rows.find((r) => r.id === "stop_referrals")?.value).toBe("fewer than 5");
    expect(rows.find((r) => r.id === "voca_victims_served")?.value).toBe("fewer than 5");
  });

  it("keeps zero as zero and leaves avg days when cohort is large enough", () => {
    const rows = mapGrantReportToDvCategories(
      sample({
        cases_opened: bucket(0),
        avg_days_to_first_follow_up: 2.2,
        advocates: 3,
      }),
    );
    expect(rows.find((r) => r.id === "vawa_cases_opened")?.value).toBe(0);
    expect(rows.find((r) => r.id === "cross_avg_days_first_follow_up")?.value).toBe(2.2);
    // advocates is not privacy-bucketed on the base report (team size is public to org admins)
    expect(rows.find((r) => r.id === "cross_staff_advocates")?.value).toBe(3);
  });

  it("formats null avg as Not enough data", () => {
    expect(formatDvCategoryValue(null)).toBe("Not enough data");
    expect(formatDvCategoryValue("fewer than 5")).toBe("fewer than 5");
    expect(formatDvCategoryValue(0)).toBe("0");
  });

  it("CSV section includes funder program and category labels", () => {
    const rows = mapGrantReportToDvCategories(sample());
    const csv = dvCategoriesToCsvRows(rows);
    expect(csv[0]).toEqual([
      "Funder program",
      "Category",
      "PatternProof measure",
      "Value",
      "Note",
    ]);
    const body = csv.slice(1).map((r) => r.join("|"));
    expect(body.some((l) => l.includes("VOCA — Victims served"))).toBe(true);
    expect(body.some((l) => l.includes("VAWA — Cases / matters opened"))).toBe(true);
    expect(body.some((l) => l.includes("FVPSA — Advocacy / support contacts"))).toBe(true);
    expect(body.some((l) => l.includes("STOP (VAWA formula) — Victims served"))).toBe(true);
    expect(body.every((l) => l.includes("Not a certified program outcome"))).toBe(true);
  });

  it("does not invent outcome or eligibility language in category labels", () => {
    const joined = DV_FUNDER_CATEGORY_SPECS.map((s) => s.category_label).join(" ");
    expect(joined.toLowerCase()).not.toMatch(/guaranteed|eligible|awarded|outcome|win/);
  });
});

describe("grant report bucket helper (unchanged)", () => {
  it("still floors 1–4 as fewer than 5", () => {
    expect(bucket(0)).toBe(0);
    expect(bucket(1)).toBe("fewer than 5");
    expect(bucket(4)).toBe("fewer than 5");
    expect(bucket(5)).toBe(5);
  });
});
