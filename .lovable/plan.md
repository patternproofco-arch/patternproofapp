
# PatternProof — Survivor-Integrity Audit & Phased Plan

This is a large brief. I've audited the existing codebase against your requirements and grouped the work into safe, shippable phases. Nothing here is destructive; every schema change is additive and RLS-preserving.

---

## Audit — what's already in place

Reused as-is (do NOT rebuild):
- Auth, RLS scaffolding, `_authenticated` gate, attorney portal split, MCP server.
- Soft-delete (`deleted_at`) + `source` / `confirmed_at` provenance on `incidents` and `evidence` (Phase 1/2 already done).
- `useConfirm` dialog replacing native `confirm()`.
- Message-thread ingest + parse pipeline (`message_threads`, `thread_messages`, `parseMessageThread`).
- Export ZIP with SHA-256 per file, `hash_of_hashes`, chain-of-custody markdown, `verify.sh`.
- Storage buckets: `evidence-files`, `voice-notes`, `message-exports`, `exports`, `conversation-recordings` (all private).
- Quick Exit hardening, PIN lock, Privacy/Terms, "encrypted in transit & at rest" language.
- Pattern analysis fetcher that already excludes soft-deleted + unconfirmed AI records.

## Critical gaps (survivor-integrity, not cosmetic)

1. **No mixed-file "dump everything" uploader.** Evidence upload is one-file-at-a-time and requires title/date up front. Violates "Add what you have. It does not need to be organized."
2. **No upload state machine or Preservation Receipt.** Users can't tell what was preserved vs. rejected. No `preserved`/`extraction_pending`/`unsupported_but_preserved` states.
3. **Originals are not hashed on ingest.** `evidence.file_url` exists but no `sha256`, `bytes`, `mime`, `original_filename`, `raw_metadata`, `preservation_status`, `integrity_verified_at`.
4. **No derivative separation.** Previews/OCR/transcripts are not modeled as derivatives of a preserved original — future edits could overwrite originals.
5. **Date certainty is a single `date` column.** No `date_certainty` enum, no ranges, no life-anchor placement. AI-approx dates silently become "day 1 of month".
6. **AI extraction ≠ AI interpretation.** Both currently flow into the same "needs confirmation" bucket; interpretation isn't distinguished from field-level extraction, and there's no explanation panel or provenance record beyond `source`.
7. **No duplicate/evidence-family grouping.** Duplicate imports inflate apparent corroboration.
8. **No work modes.** Everything demands full journal-style entry; no Upload-Only, Memory, or Low-Energy path.
9. **No import-completeness labeling on threads.** Absence of records reads as "nothing happened".
10. **"Court-ready" language + "chain of custody" still present** in exports, marketing, and route names (`/court-ready`, `/court-packet`, `chain-of-custody.md`). Needs neutral wording ("Professional-review packet", "Provenance & integrity report").
11. **Dashboard shows task-list pressure**, not "nothing requires action today" + "continue where I left off".
12. **No audit-event stream.** `audit_log` table exists but is not written on upload/hash/extraction/AI/share events.
13. **No Promise Registry.**
14. **Sharing receipts** exist partially via `attorney_access` but no survivor-facing "what was shared / expiration / downloads / revoke" screen with the required warning text.

## Non-goals for this pass
Decorative redesign, new marketing pages beyond the required Safety/Privacy/Integrity/AI/Access pages, streak/gamification removal (already absent).

---

## Phased implementation plan

### Phase A — Public trust surface (small, low-risk, ship first)
- Rename "Court Ready" → "Professional-review packet" in nav, route titles, CTAs (keep route slugs; only change visible text and metadata to avoid breaking links).
- Replace "chain of custody" phrasing in ZIP + UI with "Provenance & integrity report" and clarify hash meaning ("proves stored bytes match the preserved version — not truth, authorship, or admissibility").
- Add 4 short public pages: `/safety`, `/evidence-integrity`, `/ai-transparency`, `/professional-access`. Link from footer + `/privacy`.
- Sweep marketing copy for "court-ready", "stronger case", "abuse detected", "guaranteed admissibility", "chain of custody" and replace per the brief.
- Verify `/` renders unauthenticated (already true — regression-guard).

### Phase B — Evidence integrity core (schema + upload state machine)
Additive migration on `evidence`:
- `sha256 text`, `bytes bigint`, `mime text`, `original_filename text`, `raw_metadata jsonb`, `preservation_status text` (enum-like: `received|preserved|extraction_pending|needs_attention|unsupported_but_preserved|upload_incomplete`), `preserved_at timestamptz`, `integrity_verified_at timestamptz`, `family_id uuid`, `parent_evidence_id uuid` (for derivatives), `derivative_kind text` (`preview|thumb|ocr|transcript|redaction|export|null`), `import_batch_id uuid`.
- New table `import_batches` (id, user_id, started_at, finished_at, receipt_json, source_kind). RLS scoped to owner.
- New table `evidence_families` for duplicate grouping (id, user_id, canonical_evidence_id, note).
- New table `audit_events` (id, user_id, actor_kind, actor_id, event_type, subject_kind, subject_id, meta jsonb, created_at). RLS: owner-read only; server-only insert via SECURITY DEFINER helper.
- Grants + RLS per house style.

Server function `ingestEvidenceBatch`:
- Accepts an array of uploaded storage paths + client-provided metadata.
- Streams each object, computes SHA-256 server-side, stores metadata, writes `audit_events`, returns a `PreservationReceipt`.
- Never mutates the originally uploaded object.

New UI at `/evidence` → "Add what you have":
- Multi-file dropzone (no title/date required).
- Post-upload Preservation Receipt panel with per-file state chips.
- Warning banner: "Do not delete your original source based only on this import."

### Phase C — Date certainty + memory fragments
Additive on `incidents`:
- `date_certainty text` (`exact|approximate|month_year|range|before_anchor|after_anchor|between_anchors|sequence_only|unknown|conflicting`)
- `date_start date`, `date_end date`, `anchor_before_id uuid`, `anchor_after_id uuid`, `is_memory_fragment boolean default false`.

New table `life_anchors` (id, user_id, label, kind, start_date, end_date, notes) with RLS.

UI:
- Journal "Memory Mode" toggle → allows saving without a date; renders in timeline with an "Uncertain date" pill.
- Date input becomes a Certainty selector; existing `date` stays for exact/backfill compat.

### Phase D — AI extraction/interpretation split + explanation panel
- New table `ai_suggestions` (id, user_id, subject_kind, subject_id, kind: `extraction|interpretation`, payload jsonb, model, model_version, instruction_version, source_record_ids jsonb, status: `pending|confirmed|edited|rejected|unsure|deferred`, decided_at, decided_reason).
- Every AI-emitted field on incidents/evidence writes a matching `ai_suggestions` row instead of silently mutating the record.
- UI Explanation panel component (`AiExplanation`) rendered next to any AI-derived field: what/why/sources/uncertainty/next steps + Confirm/Edit/Reject/Unsure/Later.
- Rejected suggestions are excluded from every export by `ai_suggestions.status <> 'rejected'` filter.

### Phase E — Duplicate/evidence-family grouping + completeness
- On ingest, compute perceptual + exact duplicate signals; group into `evidence_families`; UI shows "N files represent 1 underlying record".
- `message_threads.completeness_status text` (`known_complete|complete_for_range|partial|screenshots_only|attachments_missing|possible_gaps|unknown`). Survivor sets it; default `unknown`. Empty-period copy switches to "No records are currently imported for this period."

### Phase F — Work modes + calmer dashboard
- Settings-persisted `work_mode` on `user_metadata`: `upload_only|low_energy|memory|organize|pattern_review|handoff`.
- Dashboard rewritten to show: preserved count, organized count, uncertain dates, next 1–3 useful actions, "Continue where I left off", and — when applicable — "Nothing requires action today." No % complete.

### Phase G — Sharing receipts + professional-review export rename
- Survivor-facing "Share history" view listing every grant: recipient, records, permissions, expiration, downloads, exports, revocation, with the required post-revocation warning.
- Rename export artifacts: `chain-of-custody.md` → `provenance-and-integrity.md`; ZIP filename prefix `patternproof-professional-review-`; include disclaimer block from brief.
- Redactions always produce `derivative_kind='redaction'` derivative; originals untouched.

### Phase H — Audit stream wiring + Promise Registry
- Wire `audit_events` writes into upload, hash, extraction, AI decisions, share grant/revoke, export, view.
- New file `docs/promise-registry.md` listing every public promise with control, proof, test, owner, failure behavior. Enforced in PR review; no marketing claim ships without a row.

---

## First safe code changes (this session, after you approve)

Ship Phase A end-to-end + start Phase B migration (schema only, no data change):

1. Rename user-visible "court-ready" / "chain of custody" strings across nav, dashboard, exports, marketing pages. Keep route slugs.
2. Add `/safety`, `/evidence-integrity`, `/ai-transparency`, `/professional-access` routes with plain-language copy and correct qualifiers.
3. Update export ZIP: rename `chain-of-custody.md` inside the archive, adjust integrity note, add professional-review disclaimer, prefix ZIP filename.
4. Migration: add integrity columns to `evidence` (nullable, no backfill), create `import_batches`, `evidence_families`, `audit_events` with grants + RLS. No UI hooked up yet — safe on prod.
5. Regression check: `/` renders unauthenticated; existing evidence rows still load (all new columns nullable).

Everything after Phase A/B lands in follow-up turns so each phase is reviewable in isolation.

---

## Technical notes

- All new tables follow the mandatory GRANT → RLS → POLICY order; `audit_events` has no user-facing INSERT policy (server-only via SECURITY DEFINER `record_audit_event(...)`).
- SHA-256 computed inside `createServerFn` handlers using Node `crypto` (already used in `export-zip.functions.ts`) — Worker-runtime safe.
- No changes to `auth`, `storage`, `vault`, or `supabase_functions` schemas.
- No secrets moved to client; Clio placeholder stays neutralized.
- No destructive migrations; existing survivor data is preserved and all new columns are nullable with sane defaults.

Reply "go" to ship Phase A + the Phase B migration, or tell me which phase to start with.
