# Screenshot Message Import — Phase 1

## What I found in the existing schema (read before planning)

Much of this already exists. There is **no need for a parallel case/message system**.

- **`message_threads`** — one row per imported conversation. Already has: `user_id`, `source_type`, `source_filename`, `file_url`, `conversation_participant`, `parse_status`, `parse_error`, `message_count`, `summary`, `attorney_summary`, `flags` (jsonb), `exhibit_label`, `capture_method` (`multi_screenshot` | `backup_export` | `screen_recording` | `call_log_photos`), `captured_at`, `capture_notes`, `primary_artifact_urls` (array of storage paths — the original screenshots), `screenshot_count`, `video_duration_sec`. RLS: 1 owner policy.
- **`thread_messages`** — one row per message: `thread_id`, `user_id`, `position`, `sender`, `recipient`, `sent_on`, `sent_at_time`, `body`, `attachment_name`, `attachment_url`, `flags` (jsonb). RLS: owner-scoped.
- **`cases`** — `highlighted_incident_ids`, `attached_evidence_ids`, `legal_document_ids` (no thread array yet).
- **`evidence`**, **`incidents`**, **`communications`**, **`audit_log`** (append-only hash-chained, written by `logAudit` in `src/lib/audit.functions.ts`), **`audit_events`**.
- Storage: private `evidence-files` bucket; screenshots already land at `{user_id}/thread-shots/{batch}/shot-NNN.ext`.
- Existing UI: `/message-threads` route with a Tier-1 `ScreenshotStitcher` component that uploads screenshots and calls `stitchScreenshotThread` — which **OCRs server-side via the AI gateway**, contradicting your privacy-by-default requirement.

Gaps against your spec:
1. OCR is server-side, not client-side Tesseract.js.
2. No per-field provenance (`extracted` vs `corrected`) and no correction history — edits would overwrite.
3. No duplicate/overlap merging across screenshots, and no per-message link back to *which* screenshot it came from.
4. No search / contact filter / date-range filter over thread messages.
5. Threads do **not** appear in the Timeline, are **not** selectable into the Court Packet PDF, and are **not** included in the ZIP export.
6. No "permanently delete this thread + its storage objects" action.
7. No resumable/autosaving import (all-or-nothing at the end).

**One honest correction to your brief:** the app does *not* currently have E2E encryption for stored evidence. Storage is private-bucket + RLS + TLS + at-rest encryption on the provider — files are decryptable server-side. I will match that existing model exactly (no new/parallel scheme, as you asked) and will not write UI copy claiming end-to-end encryption. Also note Phase 2 (screen recording) and parts of Phase 3 already exist in rough form; I'll leave them untouched rather than label them "coming soon".

## Integration plan

Extend `thread_messages` and `message_threads`; add exactly **two** new tables, both owner-RLS'd, both named to fit the existing schema.

### Database (one migration)
- `thread_source_documents` — one row per uploaded screenshot: `id`, `user_id`, `thread_id`, `storage_path`, `original_filename`, `upload_index`, `sha256`, `bytes`, `mime`, `ocr_status`, `ocr_confidence`, `created_at`. (Original screenshots are never discarded.)
- `thread_message_corrections` — append-only: `id`, `user_id`, `message_id`, `field` (`sender`|`sent_on`|`sent_at_time`|`body`), `old_value`, `new_value`, `source` (`ocr`|`user`), `created_at`. Corrections ADD rows; the OCR original stays readable.
- `thread_messages` additions: `source_document_id`, `source_document_ids` (array — populated when duplicates merge), `field_provenance` jsonb (`{sender:"extracted"|"corrected", ...}`), `sender_side` (`incoming`|`outgoing`|`unknown`), `date_confidence` (`explicit_date`|`relative`|`time_only`|`none`), `has_attachment_marker`, `attachment_marker_text`, `ocr_confidence`.
- `message_threads` additions: `import_status` (`draft`|`in_progress`|`complete`) and `processed_count` so an import can be paused and resumed.
- `cases` addition: `attached_thread_ids uuid[]` so threads select into the packet.
- GRANTs to `authenticated` + `service_role`; RLS `auth.uid() = user_id` on every new table; no anon grants.

### Client-side OCR
- Add `tesseract.js`, loaded lazily and only in the browser (dynamic import inside a `ClientOnly`/effect path so it never enters the SSR/Worker bundle).
- New `src/lib/ocr/` module: worker lifecycle, per-image progress, bubble-side inference from the horizontal centroid of recognized word boxes (position-based, not colour), header contact extraction from the top band, timestamp parsing (`Today 10:41 AM`, `Mon, Jan 5 at 4:32 PM`, bare `10:41 AM` → `time_only`, lowest confidence), and attachment-placeholder detection (Photo/Video/GIF/Audio/Attachment).
- Fuzzy dedupe (normalized token trigram similarity ≥ ~0.9). Messages under ~12 chars only merge when they are adjacent in upload order. Merging keeps one message row and appends the loser's `source_document_id` to `source_document_ids`.

### New / changed UI (survivor "Paper & Ink" system, mobile-first, large targets)
- `src/routes/_authenticated/import-messages.tsx` — the flow: honest explainer ("PatternProof cannot read your Messages app. This works only from screenshots you choose to add — the same way for iPhone and Android."), big "Add screenshots", upload in any order, per-image progress bar, autosave after each image, resume banner for a `draft` thread.
- `src/components/messages/` (each file under 150 lines): `ImportIntro`, `ScreenshotPicker`, `OcrProgress`, `ReviewThread`, `MessageRow` (thumbnail + inline edit + `extracted`/`corrected` field badges + correction history disclosure), `ThreadFilters` (live text search, contact filter, date range).
- Entry point button added to the existing Evidence page and to `/message-threads`; Quick Exit, PIN lock, and disguise come free from the existing shell.
- "Permanently delete this import" — removes messages, corrections, source documents, and the storage objects, and writes an audit entry.

### Existing surfaces wired up (no new export flow)
- **Timeline**: imported threads render as a dated entry per conversation-day, styled like other exhibit kinds.
- **Case Builder**: thread selection checkboxes writing `cases.attached_thread_ids`.
- **Court Packet PDF** (`court-packet.functions.ts`): threads become numbered exhibits with the message table; unchanged neutral styling.
- **ZIP export** (`export-zip.functions.ts`): adds original screenshots, `messages.json`, `corrections.csv`, and an audit manifest — as a sub-option of the existing export.
- Every import and every correction writes to the existing hash-chained `audit_log`.

### Guardrails
- No AI call anywhere in this flow; nothing here is sent to a model. The existing server-side `stitchScreenshotThread` path stays for backwards compatibility but the new flow does not use it, and any future AI step gets a per-action consent screen.
- No conclusions, no diagnoses, no unlabeled insights. Confidence badges describe extraction quality only.
- No telemetry on uploaded content; OCR text is never logged.

## Sequence
1. Migration (schema above).
2. OCR module + dedupe, with a small unit test over sample strings.
3. Import route + components, autosave/resume.
4. Review/search/filter view with provenance and correction history.
5. Timeline / Case Builder / Court Packet / ZIP integration.
6. Delete action + audit logging; Playwright pass over the flow.
