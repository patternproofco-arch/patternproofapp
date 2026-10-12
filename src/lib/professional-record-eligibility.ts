/** Browser-safe canonical professional-output eligibility. Sharing selection
 * authorizes scope, not confirmation. Null source/draft preserve legacy manual
 * records; explicitly draft or AI-unconfirmed records are never professional.
 */
type EligibilityRow = {
  deleted_at?: unknown;
  is_draft?: unknown;
  source?: unknown;
  confirmed_at?: unknown;
  review_status?: unknown;
};

export function incidentEligible(row: EligibilityRow): boolean {
  return (
    row.deleted_at == null &&
    row.is_draft !== true &&
    (row.source !== "ai_extracted" ||
      (typeof row.confirmed_at === "string" && row.confirmed_at.trim() !== ""))
  );
}

export function evidenceEligible(row: EligibilityRow): boolean {
  return incidentEligible(row) && row.review_status !== "suggested";
}
