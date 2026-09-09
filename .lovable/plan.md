# Where the app stands, and what to build next

## Honest readiness answer

**Survivor portal** — usable. Sign up, record marks, upload evidence, timeline, packet all work.

**Advocate portal** — usable. Invites, survivor-controlled scope, revoke, and packet export work.

**Attorney portal** — built, but a new attorney is stopped at setup by the paid-subscription gate, so it cannot be tested or piloted today.

**What a survivor can upload today**: photos, screenshots, PDFs, text and Word files, audio recordings, and video. Dates are read from photo metadata and from timestamps visible inside screenshots, recordings are transcribed, and the app can draft timeline entries for you to confirm.

**What is missing**: message threads can only come in as screenshots or screen recordings. There is no way to upload a CSV, a phone text export, or saved emails.

**On "detect abuse"**: the app will lay out what is already in your records — what recurs, how often, on which dates, around which events — cleanly and in order. It will not label a record as abuse or diagnose anyone. That stays your call, your advocate's, and the court's, and it is what keeps the packet credible.

---

## What to build

### 1. Message threads from real files (uploads first)

Add a file-based import path alongside screenshots, all parsed in the browser so message content never passes through an AI service:

- **CSV / spreadsheet exports** — column mapping step (date, time, sender, direction, text) with a live preview of the first rows before anything is saved.
- **Phone text exports** — plain-text and XML backup formats from common backup apps.
- **Email exports** — `.eml` files and email PDFs, keeping the original headers (from, to, sent date) as the authoritative timestamp.

Every imported message keeps: the original file it came from, its row or position in that file, the timestamp exactly as written in the source, and a note when the source gave no timezone. Nothing is rewritten or "cleaned".

### 1b. The easy ways in (the unobvious part)

Typing or screenshotting a thread is the hardest possible route. Four paths that take almost no effort:

- **Drop in the platform's own download.** Facebook, Instagram, WhatsApp, Google and Apple all let you request "a copy of your information" — one archive containing entire conversations with real timestamps. The app accepts those archives whole: drop the file in, it finds the conversations inside, you pick which ones to keep. This is the single highest-value path — one download replaces hundreds of screenshots, and the timestamps come from the platform rather than a photo of a screen. The app will walk you through requesting the download from each service, with a saved reminder for the day it's ready.
- **Share straight from the messaging app.** Add the app to your phone's share sheet, so from Messages, WhatsApp, or Mail you tap Share and pick PATTERNPROOF. Screenshots, exported chats, and forwarded emails land in an inbox in the app instead of your camera roll.
- **A private forwarding address.** Each survivor gets a private address; forward or BCC an email to it and it arrives as a dated record with its original headers intact. No app, no login, works from any device.
- **Print a thread to PDF.** Both phones can print a conversation to a PDF, which the app reads directly.

Everything lands in one **Inbox** — nothing is filed automatically. You review, then keep or discard.

### 1c. Photos and videos, with less picking

- **Bulk select** from the phone's photo picker, including whole date ranges, with the app reading each file's own date so the ordering is right without you typing anything.
- **Connect a cloud library** — Google Photos and Google Drive (Drive import already exists) — and pull in a chosen date range rather than hunting file by file.
- **Recordings are transcribed** and screenshots are read for on-screen text and timestamps, so they become searchable and datable.
- **Relevance suggestions, not decisions.** After an import the app surfaces a shortlist: files whose date sits near something already in your record, whose readable text mentions a name or place you've used, or that repeat an earlier image. Each suggestion says plainly why it surfaced, and nothing joins your record until you say yes. Everything else stays in the Inbox — private, never deleted, never auto-filed.

### 2. Metadata integrity, made visible

- The original uploaded file is never modified; a fingerprint is taken on arrival and shown on the record.
- Each date carries where it came from: photo metadata, timestamp inside the image, email header, file row, or your own entry.
- Where the app is uncertain (no timezone, relative wording like "yesterday", conflicting timestamps), it says so on the record instead of guessing a date.
- A one-page integrity summary is included with exports: file name, fingerprint, size, when it was preserved, and the source of each date.

### 3. Accurate chronological timeline

- Merge marks, evidence, imported messages, and transcribed recordings into one ordered timeline, sorted by source timestamp with a clear marker for anything undated or approximate.
- Undated items sit in a "needs a date" tray rather than being silently placed.
- Conflicting timestamps for the same event surface a calm prompt asking which one is right.
- Drafted timeline entries always require your confirmation before joining the record.

### 4. Recurrence view (factual only)

Strengthen what the patterns page shows, without interpretation:
- Counts by category, by month, by weekday, and by hour.
- Gaps and streaks in the record.
- Overlap with dates you mark as significant (exchanges, hearings, holidays).
- Every figure links back to the exact records behind it.

No severity, no diagnosis, no "this is abuse", no predictions.

### 5. Attorney portal access

Give the attorney portal a trial path so setup completes without payment, so all three portals can actually be walked end to end.

---

## Technical notes

- Parsers live client-side (`src/lib/imports/*`): CSV via a small typed parser, `.eml` via header parsing, XML/text backups via format detection. Server functions only receive normalized rows plus provenance.
- Extend `message_threads` / `messages` with `source_type` values for `csv`, `eml`, `xml`, a `source_row_index`, `source_timestamp_raw`, and `timezone_known`. Migration includes GRANTs and owner-scoped RLS.
- Reuse `ingestEvidenceBatch` for hashing and preservation of the uploaded source file; imported messages reference that evidence row.
- Timeline merge and conflict detection extend existing `contradictions.functions.ts` and `propose-timeline.functions.ts` rather than adding a parallel path.
- Recurrence math moves into a deterministic server helper (extending `frequency-observations.server.ts`) with unit tests — counts are computed in code, not by a model.
- Attorney trial: extend the existing entitlement check in `payments.functions.ts` with a time-boxed trial state; no pricing copy changes.
- Checks before finishing: typecheck, production build, Vitest suite, security and RLS scan.
