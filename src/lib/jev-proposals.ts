/** Display text is application-owned. Jev cannot create labels or narrative claims. */
export const RECORD_GROUPS = {
  messages: "Messages",
  photo: "Photos",
  document: "Documents or letters",
  financial: "Receipts or financial records",
  recording: "Audio or video",
  other: "Other or uncertain",
} as const;
export type RecordGroup = keyof typeof RECORD_GROUPS;
export const JEV_REVIEW_THRESHOLD = 0.8;
export const JEV_BATCH_SIZE = 20;
export const JEV_CANDIDATE_LIMIT = 40;
export type JevChoiceProposal = { id: string; label: string; confidence: number };
export type JevDraftCheck = {
  model: string;
  duplicate: JevChoiceProposal | null;
  checkDate: boolean;
  checkPlace: boolean;
  checkedCount: number;
};

/** Unknown permissions fail closed, including legacy nulls. */
export function permitsJev(row: { ai_permission?: string | null; is_sealed?: boolean | null }) {
  return !row.is_sealed && (row.ai_permission === "organize" || row.ai_permission === "all");
}

export function confirmJevProcessing(materials: string) {
  return window.confirm(
    `This sends ${materials} to TypeSafe's Jev AI service for optional suggestions. ` +
      "Only AI-eligible records are used. Suggestions can be wrong. Nothing is saved, shared, or sent on your behalf. " +
      "You can review manually instead. Continue?",
  );
}
