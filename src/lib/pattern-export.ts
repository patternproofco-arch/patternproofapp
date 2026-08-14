/**
 * Survivor-review gate for AI pattern analysis in exports.
 *
 * pattern_analyses.reviewed_status holds a per-claim state the survivor sets on
 * /patterns (confirmed / edited / rejected / unsure). Anything the survivor
 * rejected must NEVER reach an attorney packet or ZIP export; anything left
 * "unsure" is held back from the narrative and only counted.
 */

export type ClaimStatus = "unsure" | "confirmed" | "rejected" | "edited";
export type ReviewMap = Record<string, { status?: ClaimStatus; edited_note?: string } | undefined>;

const included = (s: ClaimStatus | undefined) => s === "confirmed" || s === "edited";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAnalysis = Record<string, any>;

export interface PatternExportResult {
  /** Markdown body lines for the pattern section (no heading). */
  lines: string[];
  /** Analysis object safe to ship as JSON: rejected/unsure claims stripped. */
  redactedAnalysis: AnyAnalysis;
  /** Count of claims held back because the survivor marked them unsure. */
  unsureCount: number;
  /** Count of claims excluded because the survivor rejected them. */
  rejectedCount: number;
}

export function buildPatternExport(rawAnalysis: unknown, rawReviewed: unknown): PatternExportResult {
  const a = (rawAnalysis ?? {}) as AnyAnalysis;
  const reviewed = (rawReviewed ?? {}) as ReviewMap;
  const statusOf = (key: string): ClaimStatus => (reviewed[key]?.status ?? "unsure") as ClaimStatus;
  const textOf = (key: string, fallback: string) => {
    const st = reviewed[key];
    return st?.status === "edited" && st.edited_note?.trim() ? st.edited_note.trim() : fallback;
  };

  let unsureCount = 0;
  let rejectedCount = 0;
  const tally = (s: ClaimStatus) => {
    if (s === "rejected") rejectedCount += 1;
    else if (s === "unsure") unsureCount += 1;
  };

  const lines: string[] = [];
  const redacted: AnyAnalysis = {};
  if (a.generated_at) redacted.generated_at = a.generated_at;

  // Interpretive fields (main_pattern_label, secondary_patterns,
  // what_pattern_may_show, abuser_tactics, pattern_summary, escalation_arc,
  // severity_trajectory, pattern_timeline_text, common_triggers,
  // escalation_before/during/after) are no longer generated and are
  // deliberately NEVER exported, even when present on older cached rows.
  // Only the whitelist below ever reaches an export.
  if (typeof a.corroborating_incident_count === "number") {
    redacted.corroborating_incident_count = a.corroborating_incident_count;
    lines.push(`Incidents counted in the record: ${a.corroborating_incident_count}`, ``);
  }

  // Severity indicators — reviewable per item.
  if (Array.isArray(a.severity_indicators) && a.severity_indicators.length) {
    const kept: AnyAnalysis[] = [];
    a.severity_indicators.forEach((s0: AnyAnalysis, i: number) => {
      const s = statusOf(`sev:${i}`);
      tally(s);
      if (!included(s)) return;
      kept.push({ ...s0, note: textOf(`sev:${i}`, String(s0.note ?? "")) });
    });
    if (kept.length) {
      lines.push(`## Documented behaviours the survivor confirmed`, ``);
      kept.forEach((s0) => lines.push(`- **${s0.label ?? "—"}** — ${s0.note ?? ""}`.trim()));
      lines.push(``);
      redacted.severity_indicators = kept;
    }
  }

  // Attorney-facing restatement — reviewable.
  if (a.attorney_summary) {
    const s = statusOf("attorney_summary");
    tally(s);
    if (included(s)) {
      const t = textOf("attorney_summary", String(a.attorney_summary));
      lines.push(`## Summary for review (confirmed by the survivor)`, ``, t, ``);
      redacted.attorney_summary = t;
    }
  }

  // Whitelist: only these count-based fields are factual restatements of the
  // survivor's own records, not AI claims — they are not review-gated. Any
  // other key on the row (including legacy interpretive fields) is dropped.
  for (const key of ["frequency_trends", "abuse_type_breakdown"]) {
    if (a[key] !== undefined) redacted[key] = a[key];
  }

  if (unsureCount > 0) {
    lines.push(
      `_${unsureCount} additional AI-suggested pattern ${unsureCount === 1 ? "item was" : "items were"} flagged as uncertain by the survivor and ${unsureCount === 1 ? "is" : "are"} not included._`,
      ``,
    );
  }
  if (rejectedCount > 0) {
    lines.push(
      `_${rejectedCount} AI-suggested pattern ${rejectedCount === 1 ? "item was" : "items were"} rejected by the survivor and ${rejectedCount === 1 ? "is" : "are"} excluded from this document._`,
      ``,
    );
  }

  return { lines, redactedAnalysis: redacted, unsureCount, rejectedCount };
}
