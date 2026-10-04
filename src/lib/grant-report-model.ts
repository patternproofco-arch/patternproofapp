/**
 * Grant report workspace — pure model (no I/O).
 *
 * What this exists to prevent:
 *  - a number that PatternProof cannot actually know being presented as fact
 *    (legal services, protective-order help, housing, outcomes, demographics);
 *  - "0" being used for "we don't know" or "we don't collect that";
 *  - a draft being exported or marked submitted without a person approving it;
 *  - "submitted" being claimed when nothing confirmed delivery.
 *
 * Every row carries an explicit ValueState. A row that is not record-supported
 * and has not been filled in by staff is "needs_staff_input" and blocks approval.
 */

export const SMALL_COUNT_THRESHOLD = 5;

/** How a value came to be. Never inferred from the number itself. */
export type ValueState =
  | "record_supported" // derived from PatternProof records for the period
  | "staff_entered" // typed in by org staff from their own records
  | "not_collected" // the organization does not collect this
  | "not_applicable" // does not apply to this funder / program
  | "unknown" // the organization cannot determine it
  | "needs_staff_input"; // nobody has answered yet — blocks approval

export const VALUE_STATE_LABEL: Record<ValueState, string> = {
  record_supported: "From PatternProof records",
  staff_entered: "Entered by staff",
  not_collected: "Not collected",
  not_applicable: "Not applicable",
  unknown: "Unknown",
  needs_staff_input: "Needs staff input",
};

export type Section =
  | "survivors_served"
  | "legal_services"
  | "protective_orders"
  | "referrals"
  | "housing_support"
  | "outcomes"
  | "narrative";

export const SECTION_LABEL: Record<Section, string> = {
  survivors_served: "Survivors served",
  legal_services: "Legal services",
  protective_orders: "Protective-order assistance",
  referrals: "Referrals",
  housing_support: "Housing support",
  outcomes: "Outcomes",
  narrative: "Narrative",
};

/** What a row counts. Unique clients and service events are never mixed. */
export type Unit = "unique_clients" | "service_events" | "text";

export type RowSpec = {
  id: string;
  section: Section;
  label: string;
  unit: Unit;
  /** Plain-language definition shown next to the number and in exports. */
  definition: string;
  /** Present when PatternProof can derive the number from its own records. */
  derivedKey?: DerivedKey;
  /** Narrative rows are free text. */
  required?: boolean;
};

export type DerivedKey =
  | "clients_with_activity"
  | "clients_who_shared_records"
  | "access_grants_started"
  | "access_ended"
  | "follow_ups_created"
  | "follow_ups_completed"
  | "clients_with_follow_up"
  | "referrals_recorded"
  | "clients_referred";

export type FunderTemplate = {
  id: string;
  name: string;
  /** Free-text reminder shown on the draft, e.g. which funder form this feeds. */
  description: string;
  rows: readonly RowSpec[];
};

/**
 * Default template. Templates are data: a funder with different categories gets a
 * different template, not different code. Row ids are stable — drafts store by id.
 */
export const DEFAULT_TEMPLATE: FunderTemplate = {
  id: "dv_general_v1",
  name: "Domestic violence funder report (general)",
  description:
    "General categories used by VOCA / VAWA / FVPSA / STOP-style reports. Check each row's definition against your funder's own definitions before you submit.",
  rows: [
    {
      id: "served_unique",
      section: "survivors_served",
      label: "Survivors with recorded activity",
      unit: "unique_clients",
      definition:
        "Unique survivors who, in the period, gave your team access to their records, had a follow-up recorded, or had a referral recorded. Each person counts once. This is PatternProof activity, not a finding that a person met your funder's definition of 'served'.",
      derivedKey: "clients_with_activity",
    },
    {
      id: "served_funder_definition",
      section: "survivors_served",
      label: "Survivors served (your funder's definition)",
      unit: "unique_clients",
      definition:
        "Unique survivors who received a service as your funder defines it. Count each person once, including people who declined optional demographic questions.",
    },
    {
      id: "demographics",
      section: "survivors_served",
      label: "Demographic breakdown",
      unit: "text",
      definition:
        "PatternProof does not collect demographics. If your funder requires them, enter them from your own records and include a 'declined or unknown' line so the groups add up to the total served.",
    },
    {
      id: "legal_service_events",
      section: "legal_services",
      label: "Legal service events",
      unit: "service_events",
      definition:
        "Count of legal services delivered (consultations, representation steps, filings) per your funder's definition. A shared journal entry or file is not a legal service.",
    },
    {
      id: "legal_clients",
      section: "legal_services",
      label: "Survivors who received legal services",
      unit: "unique_clients",
      definition: "Unique survivors who received at least one legal service. Each person counts once.",
    },
    {
      id: "po_events",
      section: "protective_orders",
      label: "Protective-order assistance events",
      unit: "service_events",
      definition: "Count of assistance events (petitions prepared, hearings attended with the survivor).",
    },
    {
      id: "po_clients",
      section: "protective_orders",
      label: "Survivors helped with a protective order",
      unit: "unique_clients",
      definition: "Unique survivors who received protective-order assistance. Each person counts once.",
    },
    {
      id: "referral_events",
      section: "referrals",
      label: "Referrals recorded",
      unit: "service_events",
      definition:
        "Referral records made by your team in PatternProof during the period. A person referred twice counts twice here.",
      derivedKey: "referrals_recorded",
    },
    {
      id: "referral_clients",
      section: "referrals",
      label: "Survivors referred",
      unit: "unique_clients",
      definition: "Unique survivors with at least one referral recorded in the period.",
      derivedKey: "clients_referred",
    },
    {
      id: "followup_events",
      section: "referrals",
      label: "Follow-ups recorded",
      unit: "service_events",
      definition: "Follow-up tasks your team created in PatternProof during the period.",
      derivedKey: "follow_ups_created",
    },
    {
      id: "followup_done",
      section: "referrals",
      label: "Follow-ups marked done",
      unit: "service_events",
      definition: "Follow-up tasks your team marked done during the period.",
      derivedKey: "follow_ups_completed",
    },
    {
      id: "housing_events",
      section: "housing_support",
      label: "Housing support events",
      unit: "service_events",
      definition: "Count of housing-related support events (placements, applications, referrals to housing).",
    },
    {
      id: "housing_clients",
      section: "housing_support",
      label: "Survivors who received housing support",
      unit: "unique_clients",
      definition: "Unique survivors who received housing support. Each person counts once.",
    },
    {
      id: "access_started",
      section: "outcomes",
      label: "Survivors who gave access to their records",
      unit: "unique_clients",
      definition:
        "Unique survivors who chose to share their records with your team in the period. This is a sign that sharing started, not an outcome of the case.",
      derivedKey: "clients_who_shared_records",
    },
    {
      id: "access_ended",
      section: "outcomes",
      label: "Survivors whose sharing ended",
      unit: "unique_clients",
      definition:
        "Unique survivors whose sharing with your team ended in the period, whether the survivor withdrew it or your team ended it. It does not mean the case is closed or resolved.",
      derivedKey: "access_ended",
    },
    {
      id: "outcomes_text",
      section: "outcomes",
      label: "Outcomes your funder asks for",
      unit: "text",
      definition:
        "Case outcomes (orders granted, safety-plan completion, etc.). PatternProof does not record outcomes. Enter them from your own records.",
    },
    {
      id: "narrative",
      section: "narrative",
      label: "Narrative",
      unit: "text",
      required: true,
      definition:
        "Written for this report. Do not paste survivors' own words, names, dates of birth, or contact details. PatternProof does not reuse legal evidence or entries here.",
    },
  ],
} as const;

export const TEMPLATES: Record<string, FunderTemplate> = {
  [DEFAULT_TEMPLATE.id]: DEFAULT_TEMPLATE,
};

/** What the server computed from records. null = could not be determined. */
export type Derived = Partial<Record<DerivedKey, number | null>>;

/** What staff typed for one row. */
export type StaffEntry = {
  state: Exclude<ValueState, "record_supported" | "needs_staff_input">;
  count?: number | null;
  text?: string | null;
  note?: string | null;
};

export type DraftContent = {
  template_id: string;
  period_from: string; // YYYY-MM-DD
  period_to: string;
  entries: Record<string, StaffEntry | undefined>;
  /** Row ids whose small counts (1–4) staff reviewed and accepted. */
  small_count_reviewed: string[];
};

export type ResolvedRow = {
  id: string;
  section: Section;
  label: string;
  unit: Unit;
  definition: string;
  state: ValueState;
  /** Exact count. Only present for count-type rows with a number. */
  count: number | null;
  /** What goes on the report. Small counts are shown as "fewer than 5". */
  display: string;
  small_count: boolean;
  text: string | null;
  note: string | null;
};

export function isSmallCount(n: number | null | undefined): n is number {
  return typeof n === "number" && n > 0 && n < SMALL_COUNT_THRESHOLD;
}

export function displayCount(n: number): string {
  return isSmallCount(n) ? `fewer than ${SMALL_COUNT_THRESHOLD}` : String(n);
}

/** Plain-language text for each non-number state, so a blank is never read as zero. */
function stateDisplay(state: ValueState): string {
  switch (state) {
    case "not_collected":
      return "Not collected";
    case "not_applicable":
      return "Not applicable";
    case "unknown":
      return "Unknown";
    case "needs_staff_input":
      return "Needs staff input";
    default:
      return "";
  }
}

export function resolveRow(spec: RowSpec, derived: Derived, entry: StaffEntry | undefined): ResolvedRow {
  const base = {
    id: spec.id,
    section: spec.section,
    label: spec.label,
    unit: spec.unit,
    definition: spec.definition,
    text: null as string | null,
    note: entry?.note?.trim() || null,
  };

  // Record-supported rows come from records only. Staff cannot overwrite them;
  // if the records could not be read, the row says unknown rather than guessing.
  if (spec.derivedKey) {
    const v = derived[spec.derivedKey];
    if (typeof v === "number") {
      return {
        ...base,
        state: "record_supported",
        count: v,
        display: displayCount(v),
        small_count: isSmallCount(v),
      };
    }
    return { ...base, state: "unknown", count: null, display: "Unknown", small_count: false };
  }

  if (!entry) {
    return { ...base, state: "needs_staff_input", count: null, display: "Needs staff input", small_count: false };
  }

  if (entry.state === "staff_entered") {
    if (spec.unit === "text") {
      const text = entry.text?.trim() || null;
      return {
        ...base,
        state: text ? "staff_entered" : "needs_staff_input",
        count: null,
        display: text ?? "Needs staff input",
        text,
        small_count: false,
      };
    }
    const n = entry.count;
    if (typeof n === "number" && Number.isFinite(n)) {
      return {
        ...base,
        state: "staff_entered",
        count: n,
        display: displayCount(n),
        small_count: isSmallCount(n),
      };
    }
    return { ...base, state: "needs_staff_input", count: null, display: "Needs staff input", small_count: false };
  }

  return {
    ...base,
    state: entry.state,
    count: null,
    display: stateDisplay(entry.state),
    small_count: false,
  };
}

export function resolveDraft(
  template: FunderTemplate,
  content: DraftContent,
  derived: Derived,
): ResolvedRow[] {
  return template.rows.map((spec) => resolveRow(spec, derived, content.entries[spec.id]));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type Issue = { rowId: string | null; severity: "error" | "warning"; message: string };

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;

export function validateDraft(
  template: FunderTemplate,
  content: DraftContent,
  derived: Derived,
): Issue[] {
  const issues: Issue[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(content.period_from) || !/^\d{4}-\d{2}-\d{2}$/.test(content.period_to)) {
    issues.push({ rowId: null, severity: "error", message: "Choose a reporting period." });
  } else if (content.period_from > content.period_to) {
    issues.push({ rowId: null, severity: "error", message: "The period starts after it ends." });
  }

  const rows = resolveDraft(template, content, derived);
  const reviewed = new Set(content.small_count_reviewed);

  for (const spec of template.rows) {
    const row = rows.find((r) => r.id === spec.id)!;
    const entry = content.entries[spec.id];

    if (row.state === "needs_staff_input") {
      issues.push({
        rowId: spec.id,
        severity: "error",
        message: `${spec.label}: needs an answer. Enter a value, or say it is not collected, not applicable or unknown.`,
      });
      continue;
    }
    if (spec.derivedKey && row.state === "unknown") {
      issues.push({
        rowId: spec.id,
        severity: "error",
        message: `${spec.label}: we couldn't read the records for this number. Try again; it is not zero.`,
      });
      continue;
    }
    if (entry?.state === "staff_entered" && spec.unit !== "text") {
      const n = entry.count;
      if (typeof n === "number" && (!Number.isInteger(n) || n < 0)) {
        issues.push({
          rowId: spec.id,
          severity: "error",
          message: `${spec.label}: use a whole number, zero or more.`,
        });
      }
    }
    if (row.small_count && !reviewed.has(spec.id)) {
      issues.push({
        rowId: spec.id,
        severity: "error",
        message: `${spec.label}: a count under ${SMALL_COUNT_THRESHOLD} can point to individuals. Review it and confirm it is safe to report.`,
      });
    }
    if (spec.unit === "text" && row.text) {
      if (EMAIL.test(row.text) || PHONE.test(row.text)) {
        issues.push({
          rowId: spec.id,
          severity: "error",
          message: `${spec.label}: looks like it contains an email address or phone number. Remove contact details before approving.`,
        });
      }
    }
    if (spec.unit === "text" && spec.required && entry?.state !== "staff_entered") {
      issues.push({
        rowId: spec.id,
        severity: "error",
        message: `${spec.label}: this row needs written text.`,
      });
    }
  }

  // Unique-client counts cannot exceed the number of survivors with any recorded activity
  // when both are known — a quick sanity check that catches event/client mix-ups.
  const total = rows.find((r) => r.id === "served_unique");
  const funder = rows.find((r) => r.id === "served_funder_definition");
  if (funder?.count != null && total?.count != null && funder.count > total.count) {
    issues.push({
      rowId: funder.id,
      severity: "warning",
      message:
        "More survivors served than survivors with recorded activity. That can be right if you serve people outside PatternProof; check it is not a count of events.",
    });
  }
  for (const spec of template.rows) {
    if (spec.unit !== "unique_clients") continue;
    const r = rows.find((x) => x.id === spec.id)!;
    if (r.state !== "staff_entered" || r.count == null || funder?.count == null) continue;
    if (spec.id !== funder.id && r.count > funder.count) {
      issues.push({
        rowId: spec.id,
        severity: "warning",
        message: `${spec.label} is higher than survivors served. A count of unique people can't be higher than the total. It may be counting events.`,
      });
    }
  }
  return issues;
}

export function blockingIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.severity === "error");
}

// ---------------------------------------------------------------------------
// Status machine
// ---------------------------------------------------------------------------

export type ReportStatus = "draft" | "approved" | "exported" | "submitted";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  exported: "Exported",
  submitted: "Submitted (staff recorded)",
};

/**
 * Allowed moves. Editing anything puts an approved/exported draft back to draft
 * (that is not a transition here — the server does it whenever content changes).
 * "submitted" is only reachable from "exported" and only with a receipt.
 */
const NEXT: Record<ReportStatus, ReportStatus[]> = {
  draft: ["approved"],
  approved: ["exported", "draft"],
  exported: ["submitted", "exported", "draft"],
  submitted: [],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return NEXT[from].includes(to);
}

/**
 * A receipt is staff's own record that the funder got the report. PatternProof
 * has no connection to any funder's system, so it can never confirm delivery.
 */
export type Receipt = {
  method: "staff_recorded";
  destination: string;
  received_on: string; // YYYY-MM-DD
  reference: string | null;
};

export function validateReceipt(r: Partial<Receipt> | null | undefined): string | null {
  if (!r) return "Add the receipt details first.";
  if (!r.destination?.trim()) return "Say where it was submitted (funder, portal or email).";
  if (!r.received_on || !/^\d{4}-\d{2}-\d{2}$/.test(r.received_on)) {
    return "Add the date the funder received it.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hashing, so "approved" means a specific version and edits are detectable
// ---------------------------------------------------------------------------

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

export async function contentHash(content: DraftContent, derived: Derived): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonicalJson({
      ...content,
      small_count_reviewed: [...content.small_count_reviewed].sort(),
      derived,
    }),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportHeader = {
  org_name: string | null;
  template_name: string;
  period_from: string;
  period_to: string;
  status: ReportStatus;
  version: number;
  approved_at: string | null;
  content_hash: string | null;
};

/** Spreadsheet rows. A draft is labelled as one, and nothing here names a survivor. */
export function toCsvRows(header: ExportHeader, rows: ResolvedRow[]): string[][] {
  const out: string[][] = [
    ["Report", header.template_name],
    ["Organization", header.org_name ?? "Your organization"],
    ["Period", `${header.period_from} to ${header.period_to}`],
    ["Status", STATUS_LABEL[header.status]],
    ["Version", String(header.version)],
  ];
  if (header.status === "draft") {
    out.push(["Notice", "DRAFT — not approved. Do not submit."]);
  }
  if (header.approved_at) out.push(["Approved on", header.approved_at.slice(0, 10)]);
  if (header.content_hash) out.push(["Version fingerprint", header.content_hash.slice(0, 16)]);
  out.push([]);
  out.push(["Section", "Row", "Counts", "Value", "Basis", "Definition", "Staff note"]);
  for (const r of rows) {
    out.push([
      SECTION_LABEL[r.section],
      r.label,
      r.unit === "unique_clients" ? "Unique survivors" : r.unit === "service_events" ? "Service events" : "Text",
      r.display,
      VALUE_STATE_LABEL[r.state],
      r.definition,
      r.note ?? "",
    ]);
  }
  out.push([]);
  out.push([
    "About these numbers",
    `Counts under ${SMALL_COUNT_THRESHOLD} are shown as "fewer than ${SMALL_COUNT_THRESHOLD}". Rows marked "From PatternProof records" count activity recorded in PatternProof, not services outside it. This is not a certified outcome report.`,
  ]);
  return out;
}
