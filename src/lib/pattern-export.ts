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

/**
 * `scopeToIncidentIds`: when the caller only has access to a subset of the
 * survivor's incidents (a case-scoped attorney/advocate grant), pass the
 * allowed incident id set here. `pattern_analyses` rows are generated once
 * per account across *all* incidents, so account-wide narrative fields
 * (pattern_summary, escalation_arc, attorney_summary, frequency_trends,
 * abuse_type_breakdown, etc.) cannot be verified as drawn only from the
 * granted subset and are suppressed entirely; severity_indicators are kept
 * only when every incident they cite is inside the allowed set. Pass
 * `null` (the default) for full-account access, where no extra scoping is
 * applied beyond the existing survivor-review gate.
 */
export function buildPatternExport(
  rawAnalysis: unknown,
  rawReviewed: unknown,
  scopeToIncidentIds: string[] | null = null,
): PatternExportResult {
  const a = (rawAnalysis ?? {}) as AnyAnalysis;
  const reviewed = (rawReviewed ?? {}) as ReviewMap;
  const allowedIncidentIds = scopeToIncidentIds ? new Set(scopeToIncidentIds) : null;
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
  // what_pattern_may_show, abuser_tactics) are no longer generated and are
  // deliberately NEVER exported, even when present on older cached rows.
  if (typeof a.corroborating_incident_count === "number") {
    redacted.corroborating_incident_count = a.corroborating_incident_count;
    lines.push(`Incidents counted in the record: ${a.corroborating_incident_count}`, ``);
  }

  // Account-wide narrative — only shippable when the caller has full-account
  // access. A case-scoped grant can't prove these sentences were drawn only
  // from the incidents it was actually given.
  if (!allowedIncidentIds) {
    if (a.pattern_summary) {
      lines.push(`## Overview`, ``, String(a.pattern_summary), ``);
      redacted.pattern_summary = a.pattern_summary;
    }
    if (a.escalation_arc) {
      lines.push(`## Change over time`, ``, String(a.escalation_arc), ``);
      redacted.escalation_arc = a.escalation_arc;
    }
    if (a.pattern_summary || a.escalation_arc) {
      lines.push(
        `_These two narrative sections are AI-generated from the survivor's own records and are not individually confirmed claim-by-claim._`,
        ``,
      );
    }
  }

  // Severity indicators — reviewable per item, and (when scoped) kept only
  // when every incident it cites is inside the granted set.
  if (Array.isArray(a.severity_indicators) && a.severity_indicators.length) {
    const kept: AnyAnalysis[] = [];
    a.severity_indicators.forEach((s0: AnyAnalysis, i: number) => {
      if (allowedIncidentIds) {
        const cites = ((s0.source_incident_ids ?? []) as string[]).filter(Boolean);
        if (!cites.length || !cites.every((id) => allowedIncidentIds.has(id))) return;
      }
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

  // Attorney-facing restatement — reviewable, account-wide only (see above).
  if (a.attorney_summary && !allowedIncidentIds) {
    const s = statusOf("attorney_summary");
    tally(s);
    if (included(s)) {
      const t = textOf("attorney_summary", String(a.attorney_summary));
      lines.push(`## Summary for review (confirmed by the survivor)`, ``, t, ``);
      redacted.attorney_summary = t;
    }
  }

  // Non-interpretive, count-based fields are factual restatements of the
  // survivor's own records, not AI claims — they are not review-gated, but
  // they're still computed account-wide, so still scope-gated.
  if (!allowedIncidentIds) {
    for (const key of ["frequency_trends", "abuse_type_breakdown", "severity_trajectory", "pattern_timeline_text"]) {
      if (a[key] !== undefined) redacted[key] = a[key];
    }
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
