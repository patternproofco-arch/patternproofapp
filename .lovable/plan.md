## Reality check first

There is **no existing screen-recording + AI-reconstruction import** in the codebase to replace. The current `/message-threads` page only accepts exported files (PDF, CSV, TXT, RSMF, ZIP) and parses them via `parseMessageThread` in `src/lib/message-threads.functions.ts`. All three tiers below are new; the existing file-export flow becomes the second half of Tier 2.

## What I'll build

### 1. Schema (one migration)
Add to `message_threads`:
- `capture_method text` — `'multi_screenshot' | 'backup_export' | 'screen_recording'`
- `captured_at timestamptz` — when the survivor performed the capture (not the upload time)
- `capture_notes text` — free text (e.g. "iPhone, Finder backup, laptop present")
- `primary_artifact_urls text[]` — storage paths of the raw evidence (screenshots array, or single video, or export file). This is what stays canonical; parsed text is the index.
- `screenshot_count int`, `video_duration_sec int` — for display

Keep `parse_status`, `summary`, `attorney_summary`, `flags`, `exhibit_label` — all three tiers reuse the existing summary-first / AI-flag pipeline.

### 2. Tier picker UI — replace top of `/message-threads`
Three plain-language cards, in this order (Tier 2 visually marked "strongest"):

```text
┌ Take screenshots (fastest) ────┐  ┌ Backup with a computer (strongest) ┐  ┌ Screen recording (fallback) ┐
│ On your own, need it now.      │  │ Recommended when you have help.    │  │ Only if nothing else works. │
└────────────────────────────────┘  └────────────────────────────────────┘  └─────────────────────────────┘
```
Below each: a warning/context line. Tier 3 shows the "takes longer / more re-exposure" warning before its file picker opens.

### 3. Tier 1 — Multi-screenshot stitch (new)
- New component `src/components/threads/ScreenshotStitcher.tsx`: accepts multiple images at once (or repeatedly), previews them in scroll order, lets her reorder/remove.
- New server fn `stitchScreenshotThread` in `src/lib/message-threads.functions.ts`:
  1. Upload each screenshot to `evidence-files` under `threads/{threadId}/shot-{n}.jpg`; SHA-256 each.
  2. Run the existing vision model (Gemini) on each screenshot to extract `{sender, timestamp, text}` per bubble — already-built pattern from `extract-incident.functions.ts`.
  3. **Dedup**: between consecutive screenshots, drop leading bubbles whose text overlaps ≥70% (normalized) with the tail of the previous screenshot. Text-based dedup — cheaper and more reliable than image similarity for chat UIs.
  4. Persist merged bubbles into `thread_messages` with `flags: { ai_extracted: true, unverified: true }`.
  5. `capture_method='multi_screenshot'`, `primary_artifact_urls` = all screenshot paths.
- Lands in Documentation (no schema change needed — attorney/export queries already filter by `review_status='suggested'` from the previous pass; this thread stays unverified until she confirms).

### 4. Tier 2 — Backup guided walkthrough (mostly wiring existing flow)
- New route section `Tier 2 walkthrough`: a 3-step guide (iPhone Finder backup / Android Google Takeout / recommend iMazing-style tool) with copy-only instructions and a "your privacy" note.
- Ends at the **existing** file uploader (PDF/CSV/TXT/RSMF/ZIP) — thread stamped `capture_method='backup_export'`.
- Visually flagged "strongest, most court-defensible" on the tier card and in the resulting thread badge.

### 5. Tier 3 — Screen recording (new)
- New component `src/components/threads/ScreenRecordingUpload.tsx`: warning modal → file picker for a video (mp4/mov/webm, ≤200MB).
- New server fn `ingestRecordedThread`:
  1. Upload video to `evidence-files`, compute SHA-256, store as the **primary** artifact.
  2. Kick off transcription via the existing `transcribeEvidence` pipeline (`openai/gpt-4o-transcribe`) — reused, not re-implemented.
  3. Store transcript on the thread's `summary` field (labeled "AI-generated — unverified"). Video URL stays canonical; transcript is a searchable index only.
- `capture_method='screen_recording'`, `primary_artifact_urls=[videoPath]`.

### 6. Cross-tier — audit trail
Every new thread writes an `audit_events` row via `record_audit_event`:
```
event_type: 'thread.imported'
subject_kind: 'message_thread', subject_id: threadId
meta: { capture_method, captured_at, artifact_count, sha256_list }
```

### 7. Thread detail view
On the existing thread card, show:
- A "How this was captured" chip (e.g. "📱 Multi-screenshot · 7 images · captured Jul 25 10:12") — always visible, always factual.
- For Tier 1/3: an "AI-extracted — unverified" badge above the parsed messages.
- Existing summary-first / flag / incident-grouping UI unchanged.

## What I'm not doing this pass
- Native mobile screenshot burst-mode (web can't trigger the system screenshotter; she takes them the normal way and uploads).
- Actual image-similarity dedup (using text-overlap instead — reason above).
- Auto-promotion Documentation → Evidence on Tier 2 hash-verify (deferred; the current Documentation/Evidence rule already handles this at the evidence-level, not thread-level).

## Files touched
- **New**: `src/components/threads/TierPicker.tsx`, `ScreenshotStitcher.tsx`, `ScreenRecordingUpload.tsx`, `BackupWalkthrough.tsx`
- **Migration**: add columns to `message_threads`
- **Update**: `src/lib/message-threads.functions.ts` (+2 fns, +audit call), `src/routes/_authenticated/message-threads.tsx` (tier picker + capture chip)

Estimated ~900 lines net. Typecheck at the end.

Confirm and I'll build. If you want to trim (e.g. skip Tier 3 for now, or accept text-overlap dedup instead of debating image-similarity), tell me before I start.