/**
 * Map privacy-bucketed org grant aggregates into common DV funder category
 * labels (VOCA / VAWA / FVPSA / STOP-style) for Harbor Legal Group and peers.
 *
 * Soft claims only: these rows restate PatternProof activity totals under
 * funder-recognizable headings. They are not certified program outcomes,
 * not a guarantee of funding eligibility, and never include names or case
 * contents. Count fields keep the existing fewer-than-5 bucketing.
 */

import type { Bucketed, GrantReport } from "@/lib/org-grant-report.functions";

/** Metric fields only — categories are derived from these. */
export type GrantReportMetrics = Omit<GrantReport, "dv_categories">;

export type DvFunderProgram = "VOCA" | "VAWA" | "FVPSA" | "STOP" | "Cross-cutting";

export type DvFunderCategoryId =
  | "voca_victims_served"
  | "voca_follow_up_contacts"
  | "voca_follow_up_completed"
  | "vawa_victims_served"
  | "vawa_cases_opened"
  | "vawa_cases_closed"
  | "vawa_active_caseload"
  | "fvpsa_advocacy_contacts"
  | "fvpsa_active_caseload"
  | "stop_victims_served"
  | "stop_referrals"
  | "cross_referrals"
  | "cross_staff_advocates"
  | "cross_avg_days_first_follow_up";

export type DvMetricKey =
  | "people_served"
  | "cases_opened"
  | "cases_closed"
  | "cases_active_end"
  | "follow_ups_created"
  | "follow_ups_completed"
  | "referrals"
  | "avg_days_to_first_follow_up"
  | "advocates";

export type DvFunderCategoryRow = {
  id: DvFunderCategoryId;
  /** Short funder program label funders recognize (VOCA, VAWA, …). */
  funder_program: DvFunderProgram;
  /** Spreadsheet / form-style category label. */
  category_label: string;
  /** What PatternProof measured (plain language). */
  measure_label: string;
  value: Bucketed | number | null;
  /** Source aggregate on the base grant report. */
  source_metric: DvMetricKey;
  /** Soft-claim note for UI / CSV. */
  note: string;
};

const SOFT =
  "Mapped from PatternProof activity totals for this period. Not a certified program outcome or funding decision.";

type Spec = {
  id: DvFunderCategoryId;
  funder_program: DvFunderProgram;
  category_label: string;
  measure_label: string;
  source_metric: DvMetricKey;
};

/** Ordered list of DV funder category rows Harbor can paste into funder forms. */
export const DV_FUNDER_CATEGORY_SPECS: readonly Spec[] = [
  {
    id: "voca_victims_served",
    funder_program: "VOCA",
    category_label: "VOCA — Victims served",
    measure_label: "People served",
    source_metric: "people_served",
  },
  {
    id: "voca_follow_up_contacts",
    funder_program: "VOCA",
    category_label: "VOCA — Follow-up contacts",
    measure_label: "Follow-ups made",
    source_metric: "follow_ups_created",
  },
  {
    id: "voca_follow_up_completed",
    funder_program: "VOCA",
    category_label: "VOCA — Follow-up contacts completed",
    measure_label: "Follow-ups completed",
    source_metric: "follow_ups_completed",
  },
  {
    id: "vawa_victims_served",
    funder_program: "VAWA",
    category_label: "VAWA — Victims served",
    measure_label: "People served",
    source_metric: "people_served",
  },
  {
    id: "vawa_cases_opened",
    funder_program: "VAWA",
    category_label: "VAWA — Cases / matters opened",
    measure_label: "Cases opened",
    source_metric: "cases_opened",
  },
  {
    id: "vawa_cases_closed",
    funder_program: "VAWA",
    category_label: "VAWA — Cases / matters closed",
    measure_label: "Cases closed",
    source_metric: "cases_closed",
  },
  {
    id: "vawa_active_caseload",
    funder_program: "VAWA",
    category_label: "VAWA — Active caseload at period end",
    measure_label: "Cases active at end of period",
    source_metric: "cases_active_end",
  },
  {
    id: "fvpsa_advocacy_contacts",
    funder_program: "FVPSA",
    category_label: "FVPSA — Advocacy / support contacts",
    measure_label: "Follow-ups made",
    source_metric: "follow_ups_created",
  },
  {
    id: "fvpsa_active_caseload",
    funder_program: "FVPSA",
    category_label: "FVPSA — Active caseload at period end",
    measure_label: "Cases active at end of period",
    source_metric: "cases_active_end",
  },
  {
    id: "stop_victims_served",
    funder_program: "STOP",
    category_label: "STOP (VAWA formula) — Victims served",
    measure_label: "People served",
    source_metric: "people_served",
  },
  {
    id: "stop_referrals",
    funder_program: "STOP",
    category_label: "STOP (VAWA formula) — Referrals recorded",
    measure_label: "Referrals recorded",
    source_metric: "referrals",
  },
  {
    id: "cross_referrals",
    funder_program: "Cross-cutting",
    category_label: "Referrals recorded (all programs)",
    measure_label: "Referrals recorded",
    source_metric: "referrals",
  },
  {
    id: "cross_staff_advocates",
    funder_program: "Cross-cutting",
    category_label: "Staff / team members (advocates)",
    measure_label: "Team members",
    source_metric: "advocates",
  },
  {
    id: "cross_avg_days_first_follow_up",
    funder_program: "Cross-cutting",
    category_label: "Average days to first follow-up",
    measure_label: "Average days to first follow-up",
    source_metric: "avg_days_to_first_follow_up",
  },
] as const;

function readMetric(report: GrantReportMetrics, key: DvMetricKey): Bucketed | number | null {
  return report[key];
}

export function mapGrantReportToDvCategories(report: GrantReportMetrics): DvFunderCategoryRow[] {
  return DV_FUNDER_CATEGORY_SPECS.map((spec) => ({
    id: spec.id,
    funder_program: spec.funder_program,
    category_label: spec.category_label,
    measure_label: spec.measure_label,
    value: readMetric(report, spec.source_metric),
    source_metric: spec.source_metric,
    note: SOFT,
  }));
}

/** Format a category value for display / CSV (keep fewer-than-5 wording). */
export function formatDvCategoryValue(v: Bucketed | number | null): string {
  if (v === null || v === undefined) return "Not enough data";
  return String(v);
}

/**
 * Build CSV lines for the DV funder category section.
 * Columns: Funder program, Category, PatternProof measure, Value, Note
 */
export function dvCategoriesToCsvRows(rows: DvFunderCategoryRow[]): string[][] {
  const header = ["Funder program", "Category", "PatternProof measure", "Value", "Note"];
  return [
    header,
    ...rows.map((r) => [
      r.funder_program,
      r.category_label,
      r.measure_label,
      formatDvCategoryValue(r.value),
      r.note,
    ]),
  ];
}
