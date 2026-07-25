# Logo swap + Photo/Video auto-attach with transcription

## Part 1 — Logo swap (contained)

Rewrite `src/components/Logo.tsx` to render the standalone ink-line SVG mark
(path `M8 8 H50 L64 22 V64 H8 Z` + `M50 8 V22 H64`, viewBox `0 0 72 72`,
stroke `#14131F`, stroke-width `2.2`, fill `none`). Keep the `LogoVariant`
prop shape so every existing call site keeps compiling; ignore the variant
visually (single mark, no tinted asset). Drop the tri-logo PNG asset JSON
imports so the marketing pages no longer reference the retired assets.

Delete the unused `src/components/BrandLogo.tsx` (facet/diamond mark, no
callers).

Favicon + PWA icon:
- Overwrite `public/icons/icon.svg` and `public/icons/icon-maskable.svg` with
  the same mark (maskable gets a paper `#F7F5F0` background and inset).
- Add a matching `public/favicon.svg` and reference it in
  `src/routes/__root.tsx` head `links` (add alongside the existing manifest
  link); replace/delete `public/favicon.ico` if present so the old icon
  doesn't leak via `/favicon.ico` fallback.
- Manifest theme_color stays `#4E3B31` unless we already know it needs an
  update — leave untouched.

## Part 2 — Photo/video auto-attach + transcription

### DB migration (single migration)

Add to `public.evidence`:
- `exif_captured_at timestamptz` — from EXIF DateTimeOriginal
- `in_image_timestamp_text text` — raw OCR match text
- `in_image_timestamp_at timestamptz` — parsed if unambiguous (nullable)
- `ingested_at timestamptz not null default now()` — server-side upload time
  (backfill from `created_at`)
- `gps_lat double precision` / `gps_lon double precision` — quarantined,
  NEVER selected by default queries. Column comments call this out.
- `gps_reveal_opt_in boolean not null default false` — survivor must flip
  this per-item before any UI/export renders GPS.
- `transcript text` — AI-generated
- `transcript_segments jsonb` — `[{start, end, speaker, text}]`
- `transcript_status text not null default 'pending'` (pending/ready/failed)
- `transcript_verified_at timestamptz`, `transcript_verified_by uuid`
- `review_status text not null default 'suggested'`
  (suggested / confirmed / skipped). Only `confirmed` rows are part of the
  official record. Existing rows backfilled to `confirmed` so the current
  timeline is unchanged.
- `suggested_incident_id uuid references incidents(id)` — proposed match,
  distinct from the current authoritative `linked_incident_id`.
- `match_reason text` — human-readable "why we matched this" (e.g.
  "EXIF date 2025-03-14 09:12 within 6 h of incident on 2025-03-14").

Grants: keep the current `authenticated` grants on `evidence`; add a
`gps_columns_visible` DB-side rule — since PostgREST doesn't do column-level
RLS naturally, the app-side rule is: `gps_lat`/`gps_lon` are never returned
by any user-facing query unless `gps_reveal_opt_in = true`. Server functions
enforce this with explicit `.select("… no gps unless opted in …")`
projections and a dedicated `getEvidenceGps({ id })` fn.

### Ingest pipeline (`src/lib/evidence-ingest.functions.ts`)

Extend `ingestEvidenceBatch` (already handles SHA-256 + perceptual hash).
Add, in order, still fully server-side:

1. Detect mime → images vs video vs other.
2. Images:
   - Parse EXIF (`exifr` npm) → `exif_captured_at`, raw GPS to quarantined
     columns.
   - Run OCR on the image (`tesseract.js` or a lighter timestamp-only regex
     over EXIF's embedded XMP where possible — realistically ship
     tesseract.js worker in a server fn; fall back to no-OCR on failure).
     Regex-extract common in-image timestamp shapes (`MMM d, h:mm a`,
     `HH:mm`, iOS "Today 9:14 AM", `MM/DD/YY HH:mm`). Store the raw hit in
     `in_image_timestamp_text` and, if unambiguous with a same-file EXIF
     date anchor, the resolved timestamp in `in_image_timestamp_at`.
3. Videos:
   - Enqueue transcription (see below). Extract EXIF/QuickTime date via
     `exifr` — same GPS quarantine.
4. Every file: unchanged SHA-256 + `ingested_at = now()`.

Matching (`findIncidentCandidates`):
- Pick the best available anchor per item: EXIF > in-image OCR >
  ingest date (last-resort, low-confidence).
- Query the user's non-deleted incidents where `date` is within a
  configurable window (default ±72 h; `settings.matchWindowHours`,
  otherwise the constant). Return up to 3 candidates with a `match_reason`
  string like "Photo captured 2025-03-14 09:12 (EXIF) — within 4 h of
  incident on 2025-03-14 05:00".
- Set `suggested_incident_id` to the top candidate; leave
  `linked_incident_id` NULL. `review_status` = `suggested`.
- Never auto-populate `linked_incident_id`.

### Transcription (`src/lib/transcribe-evidence.functions.ts` — new)

Server fn `transcribeEvidence({ evidence_id })`:
- Loads the video/audio via signed URL, POSTs to Lovable AI Gateway
  `openai/gpt-4o-transcribe` with `response_format: verbose_json` to get
  segments + words.
- Approximate speaker diarization: group adjacent segments by
  silence-gap heuristic (>1.2 s) and alternate `Speaker 1` / `Speaker 2`
  labels. Explicitly documented as approximate; never uses names.
- Writes `transcript`, `transcript_segments`, `transcript_status = 'ready'`.
  Leaves `transcript_verified_at` NULL — the UI treats NULL as
  "AI-generated — unverified".
- On ingest, kicked off in background via a follow-up server fn call from
  the client after upload succeeds (Workers have no queue; the client
  triggers it).

Verification fn `verifyTranscript({ evidence_id })`: sets
`transcript_verified_at = now()` and `transcript_verified_by = auth.uid()`.

### UI — Review queue

New route `src/routes/_authenticated/evidence-review.tsx`:
- Lists `evidence` where `review_status = 'suggested'`, paginated 6 per page.
- Each row: thumbnail (via signed URL), the three timestamps clearly
  labeled (EXIF / In-image OCR / Uploaded), `match_reason`, and 3 buttons:
  "Attach to <incident label>" · "Create new incident" · "Skip".
- "Attach" → sets `linked_incident_id = suggested_incident_id`,
  `review_status = 'confirmed'`.
- "Create new incident" → navigates to journal prefill with EXIF date.
- "Skip" → `review_status = 'skipped'` (stays out of timeline).
- Also a top banner card if there are pending suggestions >0, linked from
  the dashboard contextual-card list (after contradictions, before
  severity).

`src/components/evidence/BatchDropzone.tsx`: after ingest completes, if
any items are `suggested`, deep-link to `/evidence-review`. Do NOT surface
all matches inline — pacing rule.

`src/routes/_authenticated/evidence.tsx` (existing detail view):
- Show the three timestamps distinctly.
- If `gps_lat` server-side check indicates GPS exists (via
  `hasGps` boolean returned by `getEvidence`), show an opt-in card:
  "This file contains location data. Show it on this exhibit?" with the
  recency warning; on confirm calls `setGpsRevealOptIn`.
- For videos with a transcript: render audio/video player + segment list,
  every transcript block prefixed with the "AI-generated — unverified"
  chip until `transcript_verified_at` is set. "Confirm transcript"
  button calls `verifyTranscript`.

### Export / attorney-share safety

- All export code paths (`court-packet.functions.ts`,
  `export-zip.functions.ts`, attorney-portal getters) must NEVER include
  `gps_lat`/`gps_lon` unless `gps_reveal_opt_in = true`. Add explicit
  `select` projections and one shared helper `stripGps(row)` as a
  belt-and-suspenders guard.
- Attorney portal reads only see `review_status = 'confirmed'`; suggested
  rows are private to the survivor.
- Transcripts render with the "AI-generated — unverified" banner in the
  attorney view too, until confirmed.

## Technical notes

- New npm deps: `exifr` (EXIF + GPS, Worker-friendly), `tesseract.js` for
  OCR. If `tesseract.js` doesn't run in the Cloudflare Worker, fall back
  to skipping OCR gracefully and log; do NOT break ingest.
- Transcription uses existing Lovable AI Gateway pattern; no new keys.
- Backward-compat: all existing evidence rows get `review_status =
  'confirmed'`, so nothing disappears from the current timeline.

## Out of scope for this pass

- Bulk camera-roll picker integration (native). This pass covers the
  file-drop path; the pacing/paginated review queue is the primary
  cognitive-load control regardless of source.
- Manual speaker relabeling UI beyond a single free-text field per turn.
