# Exhibit Cross-Referencing — correlation plan

Confirming this before writing code. Everything else in the request (design system swap, homepage rebuild, court-packet export) I'll build directly after you approve this.

## What "shared anchor" means

An **anchor** is a deterministic, non-AI signal that two exhibits belong to the same underlying event or escalation. Three anchor types, computed live (no new persisted correlation table in v1):

1. **Date anchor**
   - Same exact `date` (confirmed on both), OR
   - Same `date_range_start`/`date_range_end` window overlap of ≤ 3 days, OR
   - One incident's `anchor_incident_id` points at the other.
   - Ignore unknown-date incidents (they can't corroborate a date they don't claim).

2. **Location anchor**
   - Both have `location` set; normalized (lowercase, punctuation stripped, common suffixes like "st/street/ave" folded) strings match exactly, OR share ≥ 2 significant tokens (≥ 4 chars, non-stopword).

3. **Escalation anchor**
   - Both incidents share ≥ 1 `abuse_types` value AND their dates fall within a 14-day rolling window. This is what surfaces "pattern" without any ML.

An exhibit pair can share multiple anchor types; we render all that apply.

## Sources included

Correlation runs across the survivor's own records **plus attached artifacts**, not just incidents:
- `incidents` (primary node)
- `evidence` (via `linked_incident_id` → inherits that incident's anchors; also its own `date` if present)
- `communications` (date + `linked_incident_id`)
- `legal_documents` (`effective_date` / `incident_date`)

All treated as "exhibits" with a common `{id, kind, date, location, abuse_types}` shape via a small adapter — no schema change.

## Data model

**No new tables.** One server function:

```
findCrossReferences({ case_id? }) → Array<{
  anchor_type: 'date' | 'location' | 'escalation',
  detail: string,             // "Both on Apr 12, 2025" / "3rd Ave apartment" / "coercive control, 6 days apart"
  exhibits: Array<{ id, kind, date, label }>  // 2+ exhibits per cluster
}>
```

Clusters, not just pairs — if 4 exhibits share a date, that's one cluster of 4, not 6 pairs.

Scoped by `case_id` when provided (respects the multi-case work already shipped). Only confirmed records for survivors; attorney view respects existing link scoping.

## Audience framing (same engine, different labels)

Framing is a pure presentation-layer prop, not a separate query:

- **Survivor view (`/timeline`, `/patterns`)**: labeled **"Corroboration"**. Copy: *"These records reinforce each other."* Never surfaces the word "contradiction" or "conflict" in her view. The existing `findPossibleContradictions` stays as its own separate survivor-facing "reconcile before an attorney sees" tool — different intent, different label, not merged.
- **Attorney view (`/_attorney/clients/$clientId`)**: labeled **"Cross-reference"**, and is where the other-party contradiction analysis lives (comparing opposing statements/legal documents against the record). Same correlation engine feeds the visual; the contradiction sub-analysis is layered on top only in the attorney context.

## Visual (exhibit vernacular)

Rendered in timeline view as a thin ink-colored connector line (not curved, not glowing) drawn between exhibit cards that share an anchor, with a small mono tag on the line: `ANCHOR · DATE` / `ANCHOR · LOCATION` / `ANCHOR · ESCALATION`. Hover/tap reveals the `detail` string. No BI-dashboard chrome, no "AI insight" card, no gradient.

Connector rendering uses absolute-positioned SVG overlaid on the timeline column, redrawn on resize via a `ResizeObserver`. Falls back to a stacked "Also see: EXHIBIT 003, 007" mono footer on mobile where connector lines would be unreadable.

## Assumptions worth flagging

- 3-day date window and 14-day escalation window are first-pass thresholds; easy to tune once you see real output.
- Location normalization is intentionally conservative — I'd rather miss a match than falsely link "123 Main St, Newark" with "Main Street coffee shop".
- No AI in the correlation itself. Fully deterministic and explainable, which matters if this ever gets shown to opposing counsel.
- Not persisting cluster state (same call as `findPossibleContradictions`) — recomputed live.

## Not in this feature

- No user-dismissible "resolved" state on a cluster.
- No cross-user correlation.
- No "predicted" or "suggested" links — every connector has a concrete deterministic reason.

Approve or adjust the anchor rules / thresholds / labeling and I'll build this plus the design-system swap, homepage rebuild, and de-branded court packet in one pass.
