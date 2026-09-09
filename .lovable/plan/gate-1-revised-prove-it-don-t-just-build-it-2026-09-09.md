# Gate 1 (revised): prove it, don't just build it

Feature work stays paused. This pass amends the certification rules you approved
earlier with the five corrections you just made, fixes the code that violates
them, and adds the deployed-build smoke test that local testing cannot replace.

## 1. Testing: local suite stays, deployed smoke test added

Keep the current headless local suite as the fast development check. Add a
separate, explicitly labelled deployed-build smoke test that runs only after all
local checks pass, against the live site, using fictional QA accounts and
fictional evidence only — never real survivor information.

Deployed smoke test covers: signup and login, upload, processing, sharing,
revocation, signed download links, exports, and cross-account isolation. Local
results may never be reported as production certification.

## 2. Mobile: emulation is not a device

Mobile automation uses Playwright WebKit/iPhone and Chromium/Android emulation
only. Every critical workflow additionally carries **MANUAL QA REQUIRED** status
until it passes on a physical iPhone in Safari and a physical Android phone in
Chrome. Manual-only areas: camera and file pickers, HEIC photos, keyboard
behaviour, uploads, audio/video selection, safe areas, and installed-app (PWA)
behaviour.

## 3. Preserve the original, always

The original source file is uploaded once, unchanged, into protected evidence
storage and gets its fingerprint and provenance record. Parsing may happen in
the browser where that is appropriate. Parsed normalised records are stored
separately and point back to the preserved original. Client-side parsing must
never mean the original file is discarded.

Work: audit every intake path (message-thread import, screenshot stitching,
screen recordings, chat exports, bulk paste) and make sure each one uploads and
fingerprints the untouched original before any parsed rows are written, with the
parsed rows referencing that original's id.

## 4. No forced timeline events

Pipeline becomes: Upload → Preserve → Extract → Human-reviewable extraction →
Candidate event **if supported** → Confirm / correct / reject → Timeline.

When the evidence does not contain enough to support an event, the app says
"No timeline event proposed." It never manufactures an event to complete the
pipeline. This applies to receipts, court PDFs, and long message threads with no
distinct event.

## 5. Recurrence counts events, not files

The app must distinguish event counts from evidence and message counts. Twelve
screenshots, forty messages, a recording and a PDF attached to one confirmed
event count as **one** event in recurrence. File and message counts may appear
separately only when explicitly labelled ("42 messages", "6 evidence files").
Recurrence is never inflated by supporting files.

Work: review the recurrence/observation counting so it counts confirmed events
(deduplicated by event), and label any supporting-material counts distinctly.

## 6. Typed timestamps

Every timestamp carries a semantic type, not just a value:
`message_sent_at`, `photo_taken_at`, `screenshot_created_at`, `file_modified_at`,
`email_date_header`, `email_received_at`, `recording_created_at`,
`survivor_confirmed_event_at`.

Chronology uses the timestamp appropriate to the event being represented. File
creation or upload time must never silently become the event date. A screenshot
created 9 September showing a message sent 14 August is ordered by 14 August,
and the display says which date it used.

## 7. Gate 1 rule (governs all of the above)

Preserve first. Extract without changing the source. AI proposes only what the
evidence supports. The survivor confirms. Code determines chronology from typed
source dates. Recurrence counts confirmed events without double counting
supporting evidence. Every conclusion traces back to the untouched original.

## Technical notes

- Amend `docs/portal-certification-report.md` and
  `docs/portal-certification-inventory.md` with the revised rules, the
  emulation-vs-device distinction, and the deployed smoke-test section.
- Add a `timestamp_kind` (semantic type) alongside stored dates for evidence,
  parsed messages, and proposed incidents, via migration; backfill existing rows
  to the most conservative type rather than guessing.
- Chronology resolver picks the event-appropriate typed timestamp with an
  explicit precedence per record kind, and surfaces which one it used.
- Recurrence counting keys on confirmed incident ids, not evidence rows.
- Proposal generation returns an explicit "no event proposed" outcome; the
  review UI renders that state instead of an empty draft.
- Regression tests for: no-event outcome, one-event-many-files recurrence,
  screenshot-vs-message date selection, original-preserved-after-client-parse.
- Deployed smoke test lives beside the QA scripts, is opt-in, and refuses to run
  without explicit fictional-account configuration.
- Checks before any verdict: typecheck, production build, full test suite,
  security and dependency scans, database policy checks. No deployment happens
  as part of this pass.

## Answering "what's needed for actual users"

After this pass, the remaining gates are: attorney portal certified end to end
with a real entitlement, DV organisation portal certified end to end, exports
opened and inspected by a human, record deletion exercised, real-camera photo
metadata and location handling, real recording transcription, physical-device
mobile QA, and the deployed smoke test green. Only then does a controlled pilot
verdict change.
