/**
 * Per-item AI permissions and sealing — single source of truth.
 *
 * Pure and dependency-free so every rule can be tested exhaustively and so the
 * same function can run on the server before a record is ever handed to a
 * model, an export, or a professional.
 *
 * Rules that never bend:
 *  - a sealed item is invisible to AI, to pattern grouping and to any
 *    professional surface until the survivor unlocks it;
 *  - "Store only" means exactly that — the bytes are kept, nothing is read;
 *  - an unconfirmed AI suggestion never reaches a professional export;
 *  - the default is the least processing that still makes the app usable.
 */

export const AI_PERMISSIONS = [
  "store_only",
  "transcribe",
  "organize",
  "analyze_sequences",
  "professional_summaries",
] as const;

export type AiPermission = (typeof AI_PERMISSIONS)[number];

/** Least processing that keeps search and the timeline working. */
export const DEFAULT_AI_PERMISSION: AiPermission = "organize";

const RANK: Record<AiPermission, number> = {
  store_only: 0,
  transcribe: 1,
  organize: 2,
  analyze_sequences: 3,
  professional_summaries: 4,
};

export const AI_PERMISSION_LABELS: Record<AiPermission, { title: string; help: string }> = {
  store_only: {
    title: "Store only",
    help: "Kept exactly as saved. Nothing reads it — no transcription, no grouping, no summaries.",
  },
  transcribe: {
    title: "Transcribe",
    help: "Speech or text in this item may be turned into words you can search. Nothing else.",
  },
  organize: {
    title: "Organize",
    help: "May be sorted onto your timeline and found in search. No interpretation.",
  },
  analyze_sequences: {
    title: "Analyze sequences",
    help: "May be placed next to related records so you can see what came before and after.",
  },
  professional_summaries: {
    title: "Include in professional summaries",
    help: "May appear in a summary you choose to share with an attorney or advocate.",
  },
};

/** What a given piece of work needs before it may touch an item. */
export type AiCapability =
  | "transcribe"
  | "organize"
  | "analyze_sequences"
  | "professional_summaries";

export interface PermissionedItem {
  is_sealed?: boolean | null;
  ai_permission?: string | null;
}

export function normalizePermission(value: unknown): AiPermission {
  return AI_PERMISSIONS.includes(value as AiPermission)
    ? (value as AiPermission)
    : DEFAULT_AI_PERMISSION;
}

export function isSealedItem(item: PermissionedItem | null | undefined): boolean {
  return !!item && item.is_sealed === true;
}

/**
 * The one gate. Everything that wants to read, group, summarize or export an
 * item must call this first.
 */
export function canUseForAi(
  item: PermissionedItem | null | undefined,
  capability: AiCapability,
): boolean {
  if (!item) return false;
  if (isSealedItem(item)) return false;
  return RANK[normalizePermission(item.ai_permission)] >= RANK[capability];
}

/** Drop everything the survivor has not allowed for this kind of work. */
export function filterForAi<T extends PermissionedItem>(
  rows: readonly T[],
  capability: AiCapability,
): T[] {
  return rows.filter((r) => canUseForAi(r, capability));
}

/**
 * Professional access (attorney / advocate / export) is stricter than AI: an
 * unconfirmed AI-extracted record is excluded no matter what the permission says.
 */
export interface ProfessionalCandidate extends PermissionedItem {
  source?: string | null;
  confirmed_at?: string | null;
  is_draft?: boolean | null;
}

export function canIncludeInProfessionalExport(
  row: ProfessionalCandidate | null | undefined,
): boolean {
  if (!row) return false;
  if (isSealedItem(row)) return false;
  if (row.is_draft === true) return false;
  if (row.source === "ai_extracted" && !row.confirmed_at) return false;
  return true;
}

export function filterForProfessionalExport<T extends ProfessionalCandidate>(
  rows: readonly T[],
): T[] {
  return rows.filter(canIncludeInProfessionalExport);
}

/* ------------------------------------------------------------------ *
 * Provenance labels — item 6. Derived, never stored, never guessed.
 * ------------------------------------------------------------------ */

export type SourceLabel =
  | "original_source"
  | "survivor_statement"
  | "ai_suggestion"
  | "derived_copy";

export const SOURCE_LABEL_TEXT: Record<SourceLabel, string> = {
  original_source: "Original source",
  survivor_statement: "Your words",
  ai_suggestion: "AI suggestion — not confirmed",
  derived_copy: "Derived copy",
};

export function labelForEvidence(row: {
  parent_evidence_id?: string | null;
  derivative_kind?: string | null;
}): SourceLabel {
  if (row.parent_evidence_id || row.derivative_kind) return "derived_copy";
  return "original_source";
}

export function labelForIncident(row: {
  source?: string | null;
  confirmed_at?: string | null;
}): SourceLabel {
  if (row.source === "ai_extracted" && !row.confirmed_at) return "ai_suggestion";
  return "survivor_statement";
}
