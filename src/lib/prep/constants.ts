/**
 * Court-Prep Coach & Survivor Intake — shared constants (spec v5).
 * Soft claims only. Counsel worksheet FLAG-01–10 stays open until signed.
 */

export const HEARING_TYPES = [
  { id: "protective_order", label: "Protective order" },
  { id: "custody", label: "Custody / parenting time" },
  { id: "divorce", label: "Divorce / dissolution" },
  { id: "support", label: "Support" },
  { id: "other_family", label: "Other family matter" },
] as const;

export type HearingTypeId = (typeof HEARING_TYPES)[number]["id"];

export const CHILDREN_BRACKETS = [
  { id: "under_5", label: "Under 5" },
  { id: "5_to_11", label: "Ages 5 to 11" },
  { id: "12_plus", label: "Ages 12 and up" },
] as const;

export type ChildrenBracketId = (typeof CHILDREN_BRACKETS)[number]["id"];

export const ORDER_STATUSES = [
  { id: "none", label: "No parenting order yet" },
  { id: "temporary_order", label: "Temporary order in place" },
  { id: "decree_in_place", label: "Final decree / order in place" },
] as const;

export type OrderStatusId = (typeof ORDER_STATUSES)[number]["id"];

export const LEARNING_MODES = [
  { id: "coach", label: "Practice coach" },
  { id: "guide", label: "Study guide" },
  { id: "both", label: "Both" },
] as const;

export type LearningModeId = (typeof LEARNING_MODES)[number]["id"];

/** Fields that must never appear in schema, UI, or API payloads. */
export const NEVER_COLLECTED_FIELD_KEYS = [
  "child_name",
  "child_names",
  "children_names",
  "child_dob",
  "child_birthdate",
  "children_birthdates",
  "case_number",
  "docket_number",
  "judge_name",
  "department_name",
  "confidential_address",
  "home_address",
  "acp_status",
  "safe_address",
  "practice_answer",
  "practice_answers",
  "coach_transcript",
  "mock_testimony",
] as const;

export const SESSION_COUNTY_KEY = "pp.prep.county";
export const SESSION_COURT_BRANCH_KEY = "pp.prep.court_branch";
export const SESSION_INTAKE_DRAFT_KEY = "pp.prep.intake_draft";
export const SESSION_QUIET_TAB_KEY = "pp.prep.quiet_tab";
export const SESSION_SAFETY_COPY_KEY = "pp.prep.safety_copy";

export const QUIET_TAB_TITLE = "Local Daily Weather & Forecast";
export const QUIET_TAB_FAVICON = "/icons/weather-quiet.svg";

/** Hidden/unfocused longer than this shows the pause overlay (spec v5). */
export const PREP_VISIBILITY_PAUSE_MS = 60_000;
/** No activity for this long clears in-memory drafts and redirects (spec v5). */
export const PREP_INACTIVITY_PURGE_MS = 5 * 60_000;

export const EDUCATIONAL_DISCLAIMER =
  "For educational preparation only. This does not constitute legal representation or advice. A licensed attorney or court facilitator in your area must review anything you plan to use in court.";

/** Spec §1.C standard (detailed) safety copy. */
export const SAFETY_COPY_STANDARD =
  "If you need to leave quickly, click Quick Escape or press the Esc key. This will instantly close this page, clear your current session notes, and take you to a neutral weather website. Please keep in mind: While this button changes your screen right away and clears this tab, it cannot erase your browser history, Wi-Fi records, or protect against monitoring software installed on this device. If you believe your phone, tablet, or computer is being tracked, it is safest to view this guide on a device the other party cannot access—such as a computer at a public library, your workplace, or a trusted friend's device—using a Private or Incognito window.";

/** Spec §1.C short calm safety copy for monitored-device contexts. */
export const SAFETY_COPY_SHORT =
  "You can leave this page instantly at any time by pressing Esc or clicking Quick Escape. Because web browsers keep a record of sites you visit, this button cannot erase your browsing history. For your privacy, we recommend opening this in a Private window or on a device only you use.";

/** @deprecated Prefer SAFETY_COPY_STANDARD or SAFETY_COPY_SHORT. */
export const QUICK_ESCAPE_DEVICE_WARNING = SAFETY_COPY_STANDARD;

export const PREP_PAUSE_OVERLAY_TEXT =
  "Session paused. Click anywhere when you are ready to resume.";

export const PREP_SAFE_LANDING_PATH = "/dashboard";
