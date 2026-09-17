# Gate 1: Portal certification and repair pass

New feature work is paused. Nothing new gets built until the Survivor, Attorney, and DV Organization portals are proven to work end to end — tested, repaired, retested, and documented.

The one rule everything is judged against:

**The app extracts and proposes. You confirm. Ordering is calculated, never guessed. Recurrence is counted from confirmed records only. Every result traces back to the original file.**

---

## Phase 1 — Interaction inventory

Produce `docs/portal-certification-inventory.md`: every page, button, link, form, toggle, upload, download, export, invite, filter, empty state and error state in all three portals, found by reading the code rather than by clicking around. Each one becomes a checklist line with an owner portal and a pass/fail slot.

## Phase 2 — One evidence pipeline, proven per format

Every file type travels the same path, and "it uploaded" never counts as a pass:

```text
upload  →  original preserved  →  extract (parse / OCR / transcribe)
  →  dates and source identified  →  proposal created  →  YOU REVIEW
  →  confirm / correct / reject / save for later
  →  confirmed entry joins the chronology  →  timeline reorders
  →  recurrence counts update  →  every result links back to the file
```

Format-specific first steps only:

- **Message exports** (CSV, XLSX, TXT, XML, WhatsApp, phone backups, platform archives) — parsed by code, not by AI. Each message keeps its exact text, sender, direction, timestamp as written, normalized timestamp, timezone status, thread, source file, row position, and parser version. Original wording is never rewritten.
- **Email** (EML, MBOX, email PDFs) — From, To, Cc, Subject, Date, Received headers, Message-ID, body, attachments all kept. Conflicting header dates are flagged, never silently resolved.
- **Screenshots and photos** (JPG, PNG, HEIC where supported) — OCR plus metadata plus any timestamp visible in the image. The image is never replaced by its text, message order within one screenshot is kept, and low-confidence reads are marked uncertain.
- **Documents** (PDF, scanned PDF, DOC, DOCX, TXT) — text extracted with page or section location retained so any statement points back to its page. Dates found inside are proposals only.
- **Audio and video** (MP3, M4A, WAV, MP4, MOV) — transcribed, with duration, in-recording timestamps where available, and speaker labels only where reliable. The transcript sits beside the recording, never in place of it, and is correctable.

**One event, many files.** An incident can carry messages, a screenshot, a recording, a photo and a PDF at once. Files are grouped only when you say they belong together.

**Duplicates** are surfaced as "possible duplicate" using file fingerprint, message ID, text + timestamp + sender, or image similarity. Nothing is ever auto-deleted.

## Phase 3 — Dates, timeline, recurrence

- Ordering is computed from structured dates in priority order: source message timestamp, reliable file metadata, timestamp visible in the source, email or file headers, your confirmed date, your approximate date. No model ever decides order.
- Every date shows where it came from.
- Missing timezone is recorded as unknown, never inferred.
- No date at all goes to **Needs a date**. Conflicting dates go to **Date conflict**, showing every candidate side by side for you to settle.
- Recurrence counts use confirmed records only — never pending proposals, never rejected ones. Every figure is clickable through to the exact records behind it.
- No severity, diagnosis, risk score, credibility score, case-strength or outcome language anywhere.

## Phase 4 — Portal certification

Fictional accounts only: Survivor A, Survivor B, Attorney A, Attorney B, Advocate A, Organization A.

- **Survivor** — signup, verification, login/logout, password reset, session expiry, onboarding (including back, skip, refresh, resume), dashboard states, records create/edit/delete/link, every upload format and its failure modes, timeline, recurrence, packets and exports, and all sharing controls.
- **Attorney** — a brand-new attorney must complete setup on the intended trial path without hitting the payment wall. Then invitation acceptance, client list, scope widening and narrowing, and revocation.
- **DV Organization** — treated as its own role, tested separately from advocate access. Organization administrators must not reach survivor evidence unless the survivor's authorization explicitly allows it.

**Cross-account isolation** is mandatory and release-blocking: every role pair is attacked via changed URL IDs, direct data requests, stale and revoked invites, download and export URLs, cached routes, and the back button. Reducing scope must cut off previously visible records everywhere, not just in the interface.

## Phase 5 — Everything else clickable

Dead links, blank pages, silent button failures, double-submit duplicates, disabled-state behaviour, keyboard activation, and mobile tap targets. Forms tested for required fields, bad input, long input, cancel, double submit, network failure, and server-side validation.

Mobile is treated as the primary surface: iPhone Safari, Android Chrome, and desktop widths, checking navigation, modals, file and camera pickers, sticky bars, keyboard overlap, safe areas, and horizontal overflow.

Error handling: network failure, slow connections, expired sessions, revoked shares, missing records. Failures stay calm and specific and never expose technical internals.

## Phase 6 — Security

RLS policies, table grants, storage policies, signed URLs, download and export authorization, invite tokens, service-role usage, public routes, and logs. Every authorization decision must hold on the server. Nothing is loosened to make a test pass.

## Phase 7 — Permanent regression suite

Every flow proven here gains an automated test, and every bug found gains a regression test, so future work cannot quietly break a working portal.

## Phase 8 — Report

`docs/portal-certification-report.md` with PASS / FAIL / MANUAL QA REQUIRED per portal and per format, and separate verdicts for preservation, OCR, audio transcription, video transcription, proposals, human approval, chronological ordering, date conflicts, timeline integration, recurrence, and source traceability.

Each FAIL records route, steps to reproduce, root cause, fix applied, and retest result. Anything untestable from here is marked MANUAL QA REQUIRED with exact human steps — never marked green.

The report ends with one verdict: **SAFE FOR CONTROLLED PILOT** or **NOT SAFE FOR PILOT**. It cannot be "safe" while anything involving authorization, cross-account access, consent, revocation, evidence privacy, export scope, data loss, uploads, invites, critical navigation, or crashes is unresolved.

---

## Technical notes

- Testing runs headless Playwright against the local dev server with fictional accounts; production data is not touched.
- Gaps that surface as missing pipeline stages (a format that uploads but never extracts, a proposal with no review surface) are repaired inside the existing architecture — `evidence-ingest.functions.ts`, `propose-timeline.functions.ts`, `contradictions.functions.ts`, `frequency-observations.server.ts`, `message-import.functions.ts` — not rebuilt.
- Deterministic parsers live client-side under `src/lib/imports/*`; only normalized rows plus provenance reach the server.
- Provenance columns (`date_source`, `timezone_known`, `source_row_index`, `source_timestamp_raw`, `parser_version`) are added by migration with grants and owner-scoped RLS.
- Every proposal keeps the original AI value alongside any correction; corrections never overwrite extracted content, and extracted content never overwrites the original file.
- Regression tests extend the existing Vitest suite; final gate is typecheck, production build, full suite, security scan, and RLS checks.
