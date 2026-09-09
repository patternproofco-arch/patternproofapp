# Portal Certification Report — Gate 1

Scope: Survivor, Attorney and DV Organization portals. No new features were
added. Repairs were limited to defects found during certification.

Environment: local preview (`http://localhost:8080`) running the current
working tree, against the shared Lovable Cloud backend. All accounts and
records used are fictional (`@patternproof-qa.test`). Nothing was deployed.

Companion document: `docs/portal-certification-inventory.md`.

## Verdict

**NOT SAFE FOR PILOT — pending the retests listed under "Still to certify".**

The survivor core loop is certified and one release-blocking defect was found
and repaired. The attorney and DV-organization portals were not certified end
to end in this pass, so the app cannot yet be declared safe for a controlled
pilot.

## Gate 1 rules now enforced in code

- **Preserve first.** The original file is uploaded once, unchanged, into
  protected storage and fingerprinted before anything is parsed. Parsed
  records reference the preserved original; the original is never discarded.
- **Typed timestamps.** Every date carries a semantic kind
  (`message_sent_at`, `photo_taken_at`, `screenshot_created_at`,
  `email_date_header`, `recording_created_at`, `survivor_confirmed_event_at`,
  `file_created_at`, `file_modified_at`, `ingested_at`). Chronology uses only
  event-bearing kinds. A file's creation or upload time can never silently
  become the event date — a screenshot created 9 September showing a message
  sent 14 August is an August event. `src/lib/timestamps.ts`.
- **No manufactured events.** Upload → Preserve → Extract → human-reviewable
  extraction → candidate event *if supported* → confirm/correct/reject →
  timeline. When the evidence supports no event, the app says
  "No timeline event proposed." rather than inventing one.
- **Events are not files.** Recurrence counts distinct confirmed events, with
  duplicate ids collapsed. Message and evidence-file counts are shown only
  under their own explicit labels. Twelve screenshots on one event read as one
  event.

Regression coverage: `src/__tests__/gate1-contracts.test.ts` (10 tests).

## Defects found and repaired

### 1. Accepting an AI-drafted timeline entry could never succeed (blocker)

`acceptProposedIncident` wrote `source: "ai_proposed"` into `incidents`. The
`incidents_validate_source` trigger only accepts `survivor` or `ai_extracted`,
so every attempt to accept a draft raised a database exception and the
survivor lost the action. The same handler wrote `date_precision:
"approximate"` for approximate dates, which the
`incidents_date_precision_check` constraint also rejects.

Repaired in `src/lib/propose-timeline.functions.ts`: the accepted entry is now
written as `ai_extracted` with a `confirmed_at` stamp (so it counts as
human-confirmed for recurrence and professional sharing), and approximate
dates map to `approximate_month`.

Regression coverage: `src/__tests__/timeline-proposal-contract.test.ts`.

### 2. Stale finding cleared

A previous QA note reported that saving an archive record without a type fails
silently. Retested: the app shows "Add a description and at least one type."
and does not save. No repair needed.

## Certified — PASS (evidence-backed)

| Area | Evidence |
| --- | --- |
| Public signup + consent gate | Signup requires the terms checkbox; account created and routed to onboarding |
| Survivor onboarding | Three acknowledgements plus optional PIN and state; "Open my space" lands on `/dashboard` |
| Archive record creation | Two fictional records saved (2026-03-14, 2026-04-02), both visible after reload |
| Validation | Missing type blocks the save with a calm, specific message |
| Chronology | Both records appear on `/timeline` in date order |
| Evidence upload | JPEG uploaded to the private bucket and listed on `/evidence` with its filename |
| Recurrence neutrality | `/patterns` is opt-in, states "Not a diagnosis. Not a legal conclusion.", and observation text is built only through `phrase()` (count + label + timeframe), suppressed below 2 occurrences |
| Quick Exit | Present on public and authenticated screens |
| Console/network | No console errors across signup, onboarding, archive, timeline, evidence, recurline |
| Static checks | Typecheck clean; production build clean; 198/198 tests pass |
| Database lint | 5 informational `rls_enabled_no_policy` notices only (tables intentionally reachable through server functions) |

## Still to certify — MANUAL QA REQUIRED

| Area | Why not certified |
| --- | --- |
| Attorney portal end to end | Requires an entitled subscription; setup previously stopped at "Continue to pricing". Not retested in this pass |
| DV organization portal end to end | Requires an invitation-gated org account; not exercised in this pass |
| Advocate packet PDF and ZIP export contents | Covered by runtime tests, not by a human-opened export |
| Professional-review packet contents | A previous run produced an empty packet; case-builder persistence not retested |
| Record deletion | No delete control was exercised |
| EXIF date extraction and GPS quarantine | The QA image had no EXIF payload; needs a real camera photo |
| Audio/video transcription and draft review | Needs a real recording and a Lovable AI Gateway call |
| Mobile | Automated coverage uses Playwright WebKit/iPhone and Chromium/Android **emulation** only — viewport, user agent, screen size, touch. Critical workflows stay **MANUAL QA REQUIRED** until run on a physical iPhone in Safari and a physical Android in Chrome: camera and file pickers, HEIC, keyboard behaviour, uploads, audio/video selection, safe areas, PWA install |
| Deployed-build smoke test | Local Playwright with a local webServer proves development behaviour only. It does not prove the deployed environment, auth configuration, storage policies, environment variables, redirects, or production database behaviour. A controlled smoke test against the deployed build — fictional QA accounts and fictional evidence only, never real survivor information — must run after local checks pass and cover signup/login, upload, processing, sharing, revocation, signed downloads, exports, and cross-account isolation |
| Cross-account isolation retest | Last proven on production in an earlier run, not re-proven here |

## Known limitations (working as designed, stated plainly)

- Chat exports: CSV and TXT are parsed into individual messages; PDF, Excel,
  RSMF and ZIP are stored intact and marked "queued" — deep parsing is not
  built, and the UI says so.
- PDF and DOCX evidence bodies are stored and previewed but their text is not
  extracted into the drafting pipeline.
- There is no `.eml` email import.

## Cosmetic issue

On a wide desktop viewport the `/patterns` "Ready to see what your patterns
reveal" hint runs underneath the floating Quick Exit button. Text only; no
control is blocked.
