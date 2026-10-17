/** Shared view contracts. Sources and model answers never become findings or saved records. */
export const JEV_CANDIDATE_LIMIT = 12;
export const JEV_INSTRUCTION_VERSION = "request-match-v2";
// Pilot filter only; not a calibrated accuracy guarantee or an automatic-action threshold.
export const JEV_REVIEW_THRESHOLD = 0.8;
export type JevSourceField = "title" | "description" | "transcript" | "extracted_text";
export type JevRequestProposal = {
  evidenceId: string;
  title: string;
  excerpt: string;
  sourceField: JevSourceField;
  excerptStart: number;
  sourceRevision: string;
};
export type JevRequestResult = {
  model: string | null;
  instructionVersion: string;
  suggestion: JevRequestProposal | null;
  searchedCount: number;
  checkedCount: number;
  expiresAt: string;
};
export function permitsJev(row: { ai_permission?: string | null; is_sealed?: boolean | null }) {
  return (
    row.is_sealed === false && (row.ai_permission === "organize" || row.ai_permission === "all")
  );
}
export function confirmJevProcessing() {
  return window.confirm(
    "This sends your request text and relevant excerpts from up to 12 currently shared, AI-eligible files " +
      "to TypeSafe's Jev AI service. The survivor must separately authorize this check. " +
      "Suggestions can be wrong. The check does not send or resolve your request, change records, or expand sharing. " +
      "You can review files manually instead. Continue?",
  );
}

export function requestMatchQuestion(titles: string[]) {
  return {
    type: "choice" as const,
    instructions:
      "Which candidate directly appears to contain the item explicitly described in the request? Similar topic alone is insufficient. Choose none if no direct match, ambiguous, conflicting, or insufficient text. Never decide that an item is missing, that a request is fulfilled, or that documentation should exist. Do not assess conduct or legal value.",
    criteria: Object.fromEntries([
      ["none", "No clear match or uncertain"],
      ...titles.map((title, index) => [`file_${index}`, title]),
    ]),
  };
}
