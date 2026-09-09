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

## Gate 1 implementation pass — 2026-09-09

Changes made in this pass, with the check that proves each one:

| Change | Proof |
| --- | --- |
| The model no longer has any authority over chronological ordering. The timeline prompt's "best relative order you can" instruction is gone and replaced by "YOU DO NOT DECIDE THE ORDER"; the model reports only the date the material itself states, with its type. | `src/__tests__/gate1-date-review.test.ts` asserts the old instruction is absent and the new rule present |
| Conflicting dates are surfaced, never resolved by guesswork. `dateReviewBucket()` returns `dated`, `needs_date` or `date_conflict`; a person's own confirmed date settles a conflict; file dates never create one. | 4 unit tests in `gate1-date-review.test.ts` |
| Attorney setup no longer dead-ends at pricing. Completing setup with an active founding-nine trial lands in the caseload; only accounts with no trial are sent to pricing. No blanket paywall bypass — entitlement is still explicit. | `src/routes/_attorney/setup.tsx`; end-to-end attorney run is still MANUAL QA REQUIRED |
| Upload copy now matches what the app actually does: CSV and TXT chat backups are read into messages, PDF/Excel/RSMF/ZIP are kept intact but not read, Word documents are kept but their text is not read into drafts. | `src/routes/_authenticated/evidence.tsx`, `src/components/evidence/BatchDropzone.tsx` |
| A permanent Playwright suite lives in the repository (`playwright.config.ts`, `e2e/*.e2e.ts`) instead of throwaway scripts. Public-surface specs need no accounts; portal and isolation specs skip unless fictional QA credentials are supplied via `E2E_*` environment variables. Desktop, Pixel 7 and iPhone 14 projects are emulation only. | `bun run test:e2e` (requires `@playwright/test`, which is not yet installed in this environment — **MANUAL QA REQUIRED**) |

Checks run at the end of this pass: `bunx tsgo --noEmit` clean, `bunx vitest run`
23 files / 215 tests passed, `bun run build` succeeded.

### Verdict

**NOT SAFE FOR PILOT.** Code compiles and the automated regression suite passes,
but the release blockers below are unproven, not fixed:

1. Attorney portal end to end on the trial path — not exercised against a real account.
2. DV organization and advocate portals end to end — not exercised in this pass.
3. Export contents (professional-review packet, advocate ZIP) — never opened and inspected.
4. Record and account deletion — not exercised.
5. Real EXIF, audio transcription and video transcription — need real media and a live AI call.
6. Playwright suite execution — the runner is committed but has not been run here.
7. Deployed-build smoke test with fictional accounts — not run; no deployment was made in this pass.
8. Physical iPhone Safari and physical Android Chrome QA — MANUAL QA REQUIRED.

## Browser suite now runs — 2026-09-09 (later)

`bun run test:e2e` executes. `@playwright/test` is pinned to `1.56.1`, the
version whose bundled Chromium/WebKit builds match the browsers available in
this environment; a newer pin fails with "Executable doesn't exist". A
`e2e/global-setup.ts` warm-up hits each route once first, because a cold dev
server compiles routes on first request and that reads as a flaky timeout.

Result: **24 passed, 0 failed, 12 skipped** across desktop Chromium, Pixel 7
and iPhone 14 emulation. The 12 skips are the portal specs, which stay skipped
until fictional QA credentials are supplied.

Two real defects were found and fixed by running it:

- `/sample-case` returns a 404. The route no longer exists anywhere in the
  repository — `/demo` replaced it. Nothing in the app links to it, but
  external links and the project notes still name it. The spec now covers
  `/demo`. **Any published link to `/sample-case` is dead.**
- Quick Exit could be pressed before the page was live, doing nothing. The
  spec now waits for the button's own hydration flag before pressing. This is
  a test-side fix; the pre-hydration fallback handler in `__root.tsx` is what
  covers a real person pressing it early, and that path is still MANUAL QA
  REQUIRED on a physical device.

Blockers 1-5, 7 and 8 above stand unchanged. Blocker 6 (suite execution) is
cleared.

### Verdict

**NOT SAFE FOR PILOT** — blockers 1, 2, 3, 4, 5, 7, 8 above, plus the dead
`/sample-case` link.

## Authorization pass — 2026-09-09 (professional access)

### What changed

The attorney access rules were private helpers inside
`src/lib/attorney-portal.functions.ts`. That meant the only way to check them
was to read them. They now live in `src/lib/attorney-access.server.ts` and take
the database client as an argument, so the *real* rules run in tests against an
in-memory database. The portal file keeps identical wrappers; no rule was
loosened, and the browser bundle was checked to confirm the module does not ship
to the client (`grep` of `dist/client` for a server-only error string: 0 hits).

`docs/account-deletion-procedure.md` is new: a six-step, verifiable internal
deletion procedure with the current owning-column inventory, storage buckets,
a revocation-first ordering, and a mandatory verification step. It matches what
the app actually advertises (deletion by request, not self-service).

### Proven this pass — `src/__tests__/attorney-authorization.test.ts` (16 tests)

Fictional accounts only. Each item below is an executed assertion, not a reading
of the source:

- PASS — an active link resolves, and a case-scoped link is confined to that
  case's own records; ids from any other case are rejected.
- PASS — revoking the link denies access.
- PASS — an elapsed sharing window denies access.
- PASS — an attorney cannot reach a survivor who never shared with them.
- PASS — widening scope exposes the newly attached record; narrowing scope
  removes it; scope is re-read on every check, so a stale copy cannot be
  replayed.
- PASS — a current firm colleague inherits the same case confinement.
- PASS — the grant goes inert when either attorney leaves the firm, and when the
  survivor revokes the underlying link.
- PASS — an attorney with no grant and no collaboration is refused.
- PASS — the survivor can still reach her own message thread after the window
  lapses; the attorney cannot.
- PASS — a stranger who guesses a link id is refused; a revoked link refuses
  everyone.
- PASS — the attorney role check accepts an attorney and refuses a survivor.

### Checks run

- `bunx tsgo --noEmit` — clean.
- `bunx vitest run` — 231 passed, 24 files. One stale source-string test in
  `multiseat-security.test.ts` was repointed at the extracted module.
- `bun run build` — succeeds.
- `bun run test:e2e` — 24 passed, 0 failed, 12 skipped (portal specs still
  credential-gated).

### Still unproven — release blockers

1. Attorney portal end to end on the trial path against a real account
   (signup, onboarding, caseload, accepting an invite, notes, downloads).
   The authorization rules behind it are now tested; the journey is not.
2. Advocate and DV organization portals end to end against real accounts.
3. Export contents — the professional-review packet and advocate ZIP have not
   been generated and opened in this pass. The advocate ZIP has one existing
   content test; the professional-review packet has none, and the previously
   reported empty packet is neither reproduced nor cleared.
4. Record and account deletion — the procedure is written and verifiable, but
   it has not been exercised end to end against fictional data.
5. Real EXIF, audio transcription and video transcription with real media and a
   live AI call.
6. Previously issued signed download/export URLs after scope reduction or
   revocation — the database rules are proven, the URL expiry behaviour is not.
7. Deployed-build smoke test with fictional accounts. No deployment was made.
8. Physical iPhone Safari and physical Android Chrome QA — MANUAL QA REQUIRED.
9. The dead `/sample-case` link stands.

### Verdict

**NOT SAFE FOR PILOT** — blockers 1-9 above.

## Pass — exports built and opened (this pass)

### What changed

- `src/lib/court-packet.server.ts` (new) holds the real packet builder,
  extracted from the download endpoint and parameterised by the database
  client. `court-packet.functions.ts` is now a thin wrapper that supplies the
  account's own client, and it refuses an empty selection with a plain message
  instead of handing back a blank download. This closes the previously
  reported "empty professional-review packet": a case with nothing attached
  now says so rather than downloading a near-empty file.
- `src/lib/export-zip.server.ts` (new) holds the survivor archive builder, same
  extraction. `export-zip.functions.ts` keeps only the upload and the one-hour
  signed link.
- `src/__tests__/court-packet-export.test.ts` (new, 6 tests) builds a real PDF
  and re-opens it with pdf-lib.
- `src/__tests__/survivor-export-zip.test.ts` (new, 6 tests) builds a real ZIP
  and re-opens it with JSZip.

### Evidence — professional-review packet (PDF)

- Output starts with `%PDF-`, is >1 KB and loads as a 6+ page document.
- Counts match the account's own selection exactly: attached entries only.
  A deleted entry, an unattached entry and another account's entry are all
  excluded.
- No query touches `proposed_incidents` or `evidence_incident_drafts`, so
  unconfirmed AI suggestions cannot enter a packet.
- Every read carries an `eq:user_id` filter; building another account's case
  throws "Case not found".
- An empty selection returns zero exhibits and the endpoint refuses it.

### Evidence — survivor archive (ZIP)

- Real ZIP opens and contains `manifest.json`, `narrative.md`,
  `incidents.csv`, `evidence.csv`, `provenance-and-integrity.md`, `verify.sh`
  and the evidence file itself.
- The SHA-256 recorded in `manifest.json` matches a re-hash of the bytes
  actually stored in the archive; `hash_of_hashes` is present.
- Case-scoped export contains only the attached entry — the unattached,
  deleted and other-account entries are absent from `incidents.csv`.
- Evidence marked `suggested` is excluded, and quarantined GPS coordinates do
  not appear in the CSV.
- Requesting another account's case returns `case-not-found`.

### Checks run

- `bunx tsgo --noEmit` — clean.
- `bunx vitest run` — 243 passed, 26 files.
- `bun run build` — succeeds; no server-only builder strings in `dist/client`.
- `bun run test:e2e` — 24 passed, 0 failed, 12 skipped (portal specs remain
  credential-gated).

### Blockers cleared this pass

- Export contents (blocker 3): both the packet PDF and the survivor archive
  are now generated and inspected programmatically, and the empty-packet
  report is resolved.

### Still unproven — release blockers

1. Attorney portal end to end on the trial path against a real account.
2. Advocate and DV organization portals end to end against real accounts.
   (Rule-level proof exists: a user holding no link — including an org
   owner/admin — resolves no grant, and org oversight reads no content.)
3. Record and account deletion not exercised end to end against fictional data.
4. Real EXIF, audio and video processing with real media and a live AI call.
5. Signed download/export URL behaviour after scope reduction or revocation.
6. Deployed-build smoke test. No deployment was made in this pass.
7. Physical iPhone Safari and physical Android Chrome QA — MANUAL QA REQUIRED.
8. The dead `/sample-case` link stands.

### Verdict

**NOT SAFE FOR PILOT** — blockers 1-8 above.

## Live account pass — 2026-09-09 (attorney trial path)

Environment: local preview against the shared Lovable Cloud backend. All
accounts and records fictional (`@patternproof-qa.test`). Nothing deployed.

### Certified — PASS (live, evidence-backed)

| Step | Evidence |
| --- | --- |
| Survivor signup → consent → onboarding → dashboard | Fresh fictional account reached `/dashboard`; no console errors |
| Archive record saved | `201 POST /rest/v1/incidents`; record persists after reload |
| Evidence upload (JPEG) | `200` storage upload + signed-URL read; item listed on `/evidence` |
| Case builder → professional-review packet | Packet renders the case overview, the incident (2026-08-14) and the evidence index — the previously reported empty packet is not reproducible |
| Attorney invite created by survivor | Pending secure link shown; `attorney-invitation` email enqueued |
| Attorney signup → invite acceptance | Acceptance created an `active` `attorney_client_links` row bound to the invited email |
| Attorney trial entitlement | After `/setup`, the attorney reached `/caseload` and `/clients` with no paywall bounce |
| Scoped matter view | Client file shows only the shared record and evidence (1 incident / 1 evidence item) |
| Attorney packet download | Signed ZIP fetched, `200`, 5312 bytes; contains `incidents.csv`, `evidence.csv`, the evidence JPEG, `00_cover.md`, `03_timeline.md` with the correct 2026-08 event, and `manifest.json` with a SHA-256 per file |
| Revocation | Survivor revoke set the link to `revoked`; attorney packet call returns `{ok:false,"no-active-link"}` and `getClientCase` throws `No active access` |
| Cross-account isolation | Attorney A requesting Survivor B (no link) → `No active access` / `no-active-link` |

### Defect found and repaired

After the client revoked access, the attorney matter page sat on
"Loading matter file…" forever. Server-side data was correctly denied, so this
was presentation only, but it read as a broken page. `clients.$clientId.tsx`
now tracks the failed load and shows "Access to this matter has ended" with a
route back to the matter list.

### Residual behaviour, stated plainly

A signed export URL issued *before* revocation stays valid for the remainder of
its one-hour lifetime. This matches the disclosure shown to both parties
("material already exported remains in the attorney's possession"), but it is
not instant invalidation and should be described that way.

### Checks run

- `bunx tsgo --noEmit` — clean.
- `bunx vitest run` — 243 passed, 26 files.
- `bun run build` — succeeds.
- `bun run test:e2e` — 24 passed, 0 failed, 12 skipped (credential-gated).

### Still unproven — release blockers

1. Advocate and DV organization portals end to end against live accounts
   (rule-level proof only).
2. Record and account deletion not exercised end to end.
3. Real EXIF, audio and video processing with real media and a live AI call.
4. Deployed-build smoke test — no deployment made.
5. Physical iPhone Safari / Android Chrome QA.
6. Attorney matter dashboard still labels survivor-entered ratings as
   "AVG SEVERITY", "Escalation arc" and "Urgent risk flags" — wording to review
   against the no-interpretation rule.
7. The dead `/sample-case` link stands.

### Verdict

**NOT SAFE FOR PILOT** — blockers 1-7 above. The attorney trial path itself is
now certified.
