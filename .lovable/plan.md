## Build plan: 5 exceptional features

Building in this order so each phase is independently shippable and testable.

### Phase 1 — Communication Log (new surface)
**DB:** new table `communications` (id, user_id, date, time, channel [text/call/email/voicemail/social/in-person], direction [incoming/outgoing/missed], from_party, content, screenshot_url, linked_incident_id, harassment_flag, created_at). RLS owner-only. Storage reuses `evidence-files` bucket under `comms/` prefix.
**UI:** new route `/communications` with list + "Log communication" form + filter by channel/date. Sidebar entry between Evidence and Voice Notes.
**Court packet:** include flagged comms in the chronology.

### Phase 2 — Voice Note Transcription
**Server fn:** `transcribeVoiceNote({ voiceNoteId })` — downloads audio from `voice-notes` bucket, sends to Lovable AI (`google/gemini-2.5-flash` with audio inline), saves `transcript` text. Add `transcript` + `transcribed_at` columns to `voice_notes`.
**UI:** on Voice Notes page, "Transcribe" button per note, shows transcript inline once ready. Search bar searches transcripts.

### Phase 3 — Real AI Pattern Analysis
**Server fn:** `analyzePatterns()` — loads all user's incidents + escalation flags + comms, sends to `google/gemini-2.5-pro` with structured-output tool call returning: { frequency_trends[], escalation_arc, abuse_type_breakdown[], gaps[], suggested_followups[], severity_trajectory }. Cache in new `pattern_analyses` table (id, user_id, analysis_json, incident_count_at_time, created_at).
**UI:** revamp Dashboard "Pattern Analysis" card → full panel on `/patterns` route with: timeline chart, escalation arc narrative, gaps list with "Add entry" CTAs, AI-generated pattern summary auto-pushed into `cases.pattern_summary`. "Refresh analysis" button.

### Phase 4 — Calendar Heat Map
**UI only:** new component `IncidentHeatMap` on dashboard + standalone `/calendar` route. Month grid, color intensity = incident count, severity tints from escalation flags. Click day → filtered incident list. Pure client-side aggregation from existing `incidents` query.

### Phase 5 — Full Data Export (ZIP)
**Server fn:** `generateExportZip()` — uses `jszip` to build:
- `narrative.md` (AI-generated chronological narrative)
- `incidents.csv`, `evidence.csv`, `communications.csv`, `voice_notes.csv` (with transcripts)
- `pattern_analysis.json`
- `court_packet.pdf` (rendered server-side from existing court packet HTML via `@react-pdf/renderer` OR client-side print fallback if Worker can't handle it)
- `evidence/` folder with original files + metadata sidecar JSON (filename, SHA-256, original date, linked incident)
- `manifest.json` (export timestamp, file count, total hashes)

Returns a signed download URL (uploaded to new `exports` private bucket, 24h expiry). UI: "Export Everything" button on Settings → progress modal → download link.

### Cross-cutting fixes (included)
- **Date timezone bug** in `IncidentCard` and anywhere using `new Date(dateString).toLocaleDateString()` — parse with `T00:00:00` suffix.
- **Newline sanitization** on incident `location` / `witnesses` fields before insert.

### Risks / decisions
- **Court packet PDF in Worker:** `@react-pdf/renderer` is Worker-compatible but heavy. Fallback: ship HTML in the ZIP and let user print-to-PDF from browser. I'll try PDF first, fall back cleanly.
- **Audio transcription:** Lovable AI Gateway supports audio via Gemini 2.5 Flash. If a recording exceeds model limits, return a friendly "too long to transcribe automatically" message.
- **Pattern analysis cost:** caching results means re-analysis only runs on user request or when incident count grows by ≥3.

### Execution
I'll ship phase 1 (Communication Log) first end-to-end including migration, then proceed through 2→5 in sequence. Each phase ends with a working, verifiable feature. Estimated 5 separate commits-worth of work in this loop.

Approve to start with Phase 1?
