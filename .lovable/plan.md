# Evidence Intake Expansion — integration plan

## What already exists (verified by reading the code/schema)

- **Screenshot import**: `src/routes/_authenticated/import-messages.tsx` + `src/components/messages/*`, client-side OCR in `src/lib/ocr/run.ts` (Tesseract.js, browser-only) and `src/lib/ocr/parse.ts` (line grouping, bubble-side guess, timestamp parsing, fuzzy trigram dedupe with a short-text guard). Server side: `src/lib/message-import.functions.ts` with draft/`in_progress`/`complete` resume, append-only `thread_message_corrections`, `field_provenance`.
- **Threads already flow through**: Timeline (toggle), Case Builder (`cases.attached_thread_ids`), Court Packet PDF, and the evidence ZIP export. No new export path is needed anywhere below.
- **Evidence ingest** (`src/lib/evidence-ingest.functions.ts`): already computes `sha256` and a dHash `perceptual_hash`, and **already compares against all of the user's prior evidence** — cross-session duplicate detection exists at the data layer; it is the UI surfacing that is thin.
- **Screen recordings**: `ScreenRecordingUpload.tsx` uploads video and calls a server AI transcription (`transcribeRecordedThread`) — that contradicts the client-side-OCR rule for this feature.
- **Date certainty**: `incidents` has `date_precision` / `date_range_start|end` / `anchor_label`. **`evidence.date` is `NOT NULL` with no precision column** — this is the regression to restore.
- **Voice transcription**: `transcribe-voice-note.functions.ts` exists and is reusable.
- **Patterns**: `pattern-analysis.functions.ts` is an AI narrative analysis; the requested neutral counts are a separate, deterministic thing.

## Schema changes (one migration, extends existing tables)

- `evidence`: add `date_precision` (`exact` | `approximate` | `unknown`, default `exact`), `date_range_start`, `date_range_end`, `anchor_label`, and make `date` nullable; add `exif_choice` (`kept` | `stripped` | `none`), `voice_caption`, `voice_caption_audio_url`, `review_status` default stays as-is for "unreviewed" badging.
- `message_threads`: add `frame_interval_sec` and reuse existing `capture_method='screen_recording'`, `import_status`, `processed_count` for resume.
- `thread_source_documents`: add `kind` (`screenshot` | `video_frame`) and `frame_time_sec` so frames link back to their video timestamp.
- New `intake_batches` (owner-RLS): `id`, `user_id`, `status`, `kind_counts` jsonb, `queued_files` jsonb (names/sizes/hashes for resume), `created_at/updated_at` — one row per mixed batch so uploads resume across sessions.
- New `evidence_classification_suggestions` (owner-RLS): `evidence_id`, `suggested_kind`, `confidence`, `rationale`, `status` (`suggested`|`accepted`|`rejected`), `model`. AI output is never written onto `evidence` directly.
- GRANTs to `authenticated` + `service_role`, RLS `auth.uid() = user_id` on all new tables, no anon.

## 1. Screen-recording transcription via client-side OCR

- New `src/lib/ocr/frames.ts`: decode the video in-browser (`HTMLVideoElement` + `canvas`), sample every ~1.5s, skip frames whose downscaled pixel diff is below a scroll threshold, then feed each kept frame through the **existing** `recognizeImage` + `parse.ts` pipeline.
- Frames are stored as `thread_source_documents` rows (`kind='video_frame'`), so every extracted message keeps a source thumbnail exactly like screenshots. The original video stays the primary artifact.
- Same `mergeDuplicates` pass, same thread reconstruction, same Timeline / Case Builder / Court Packet / ZIP wiring. `ScreenRecordingUpload` is repointed at this local path; the old server AI call stays only as an explicitly consented, badged fallback.

## 2. Burden-reduction fixes

- **One "Add evidence" entry point**: single dropzone/picker with `multiple`, `accept="image/*,video/*,audio/*,.pdf,..."`, plus a separate `capture="environment"` camera button for photographing paper documents. Type is auto-detected per file (MIME + extension) and routed: images/video-of-a-conversation → message import pipeline; everything else → `evidence-ingest`.
- **Date certainty on every item**: a shared `DateCertaintyField` component (confirmed / approximate + optional anchor text / no date) used by evidence, batch intake, and threads, writing the new evidence columns. Nothing forces a date.
- **EXIF choice**: parse EXIF in the browser before upload; if GPS or device timestamp is present, show a per-file choice — keep (strengthens timestamp/location) or strip (safer if shared). Stripping re-encodes the image client-side before upload. Never silent either way; the choice is recorded in `exif_choice` and audited.
- **Universal resume**: `intake_batches` + IndexedDB-backed local file queue. Closing the tab mid-batch leaves a resume banner; already-uploaded files are not re-asked for.
- **Offline queue**: the same IndexedDB queue drains automatically on `online`, with a visible "waiting for connection" state instead of a silent failure.
- **Voice caption**: optional record-while-uploading control on any photo/video; audio goes to the existing `voice-notes` bucket and reuses the existing transcription function to fill the caption.
- **Cross-session duplicates**: surface the existing `sha256` / `near_duplicate_of` results in the intake UI ("You added this file on 12 March") with keep-both / skip choices, and apply the same fuzzy check for re-imported screenshots.
- **OCR fallback**: when confidence for an image or message is below threshold, show an inline "type what this says" field instead of a blank row; the typed value is recorded as a `corrected` field with full history.
- **No correction wall**: low-confidence items save and appear in the Timeline immediately with an "unreviewed" badge and a "review when you're ready" affordance. Nothing blocks usage.

## 3. Consent-scoped file organization suggestions

- No library access. She picks specific files or a date range per import; a short consent panel states exactly what leaves the device for classification and that it can be skipped entirely.
- Classification returns a content-type guess only — document / screenshot / photo of physical damage / injury photo / other — written to `evidence_classification_suggestions`, never to `evidence`.
- Review UI: one tap per item (or accept-all per batch) to confirm or reject. Suggestions render in the app's existing AI-content styling (distinct surface + "AI suggestion — content type only" label) and always link to the file.
- Copy and code names use "content-type organization" throughout. No scanning-for-abuse framing anywhere.

## 4. Neutral frequency observations

- New deterministic `src/lib/frequency-observations.functions.ts` — SQL counts over incidents, communications, thread messages, court dates, and evidence. Examples: "4 late pickups logged this month", "3rd cancelled visitation this quarter", each returning the exact source row IDs.
- Off until opted in (settings toggle), rendered on the Patterns page and dashboard in the AI/observation styling, each row expanding to the underlying entries.
- Hard rule enforced in code and copy: counts and dates only — no characterization, no "pattern of abuse", no clinical or legal language. A shared vocabulary constant keeps output phrasing to `{count} {event label} {timeframe}`.

## Chronology

All new sources normalize to the same timeline item shape already used by threads and evidence: exact dates sort by date, approximate dates sort by range midpoint with a visible "approximate" marker, unknown dates collect in an "undated" section rather than being guessed into place.

## Build order

1. Migration (schema above).
2. Date-certainty field + evidence nullable-date wiring (restores the lost spec first).
3. Mixed-batch intake: dropzone, camera capture, type routing, EXIF choice, duplicate surfacing.
4. IndexedDB queue → universal resume + offline drain.
5. Video frame extraction into the existing OCR/dedupe/thread pipeline.
6. OCR fallback + unreviewed badging in Timeline.
7. Voice caption.
8. Consent-scoped classification suggestions.
9. Neutral frequency observations, opt-in.
10. Playwright pass across intake, resume, and timeline ordering.
