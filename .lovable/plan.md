# Gap analysis: 15 items vs. actual code

Verified by reading the code. Verdicts: **BUILT**, **PARTIAL**, **MISSING**.

## Survivor

**1. Auth with survivor role — PARTIAL.** Auth is plain Supabase email/password (`src/lib/auth-context.tsx:19-40`). There is no survivor role row: `login.tsx:75-91` signs up with no `user_roles` insert. `getMyRole()` (`attorney-portal.functions.ts:206-229`) returns `"survivor"` as a *code fallback* when no attorney/collaborator row exists. `user_roles` is only ever written for attorneys (`attorney-invitations.functions.ts:184`). Consequence: `_authenticated.tsx:26-35` gates on "is logged in", not "is a survivor" — an attorney account can walk into survivor routes.

**2. Unskippable disclosure before first entry — PARTIAL.** `/onboarding` is force-redirected for any un-onboarded user (`_authenticated.tsx:48-55`) and the CTA is disabled until Privacy + Terms are checked (`onboarding.tsx:174-181`). But **the specific disclosure you asked for does not exist**: nothing says the record may be used legally / is discoverable / may be read by opposing counsel. Closest copy is "not a law firm, not a crisis service" (`onboarding.tsx:118-127`). Also: `OnboardingModal.tsx` and `FirstTimeEducationModal.tsx` are **dead code** — never imported anywhere.

**3. Entry with text/photo/voice + date states — PARTIAL.** Date states are *better* than you asked: six precisions (`exact, approximate_month, range, before_anchor, after_anchor, unknown`) with `date_range_start/end` and `anchor_incident_id` (`journal.tsx:32-53,144-148`). Text is fully supported. **Photo/voice are not part of the entry model** — an incident has no attachment field. Photos in `journal.tsx:241-266` are uploaded only to run AI extraction into the text form and are then discarded from the record. Evidence and voice notes are separate tables/routes linked back by `linked_incident_id`.

**4. Timeline immediate, sorted by precision — PARTIAL.** No threshold gate exists (good — `timeline.tsx:211-216` just shows an empty state). But sorting is `sort((a,b) => a.date < b.date ? 1 : -1)` (`timeline.tsx:163`) — pure date desc. `date_precision` is fetched but used only for label formatting, never ordering.

**5. Quick exit = real logout — MISSING (this is the most serious finding).** `QuickExitButton.tsx:14-36` clears only `sessionStorage` `pp.*` keys, resets the title, and redirects. It **never calls `supabase.auth.signOut()`**, and the Supabase client persists the session in `localStorage` (`client.ts:23-24`). So after a "quick exit", reopening the app restores the logged-in session with no PIN and no login. The attorney side *does* call `signOut()` (`_attorney.tsx:180`), so this is an asymmetry, not a platform limit.

**6. Survivor-visible consent log — PARTIAL.** `share-with-attorney.tsx:224-280` lists active counsel (name/firm/email/created date) and allows revoke. It does **not** show, per active grant, the scope, date-range window, or expiry — those exist on the row but are only rendered transiently at creation time. The `audit_log` shown in `settings.tsx:61-72` is an integrity/hash-chain log, not a who-viewed-what access log.

**7. Edit/delete own entries — BUILT.** Edit (`journal.tsx:178-198`), soft delete via `deleted_at` with an 8s undo (`:204-225`), and all reads filter `.is("deleted_at", null)`.

**8. 25MB cap with inline error — MISSING as specified.** There is no unified cap and no 25MB anywhere. Actual limits are scattered and inconsistent: 200MB video (`ScreenRecordingUpload.tsx:24`), 20MB thread files (`message-threads.tsx:136`), 8MB screenshots/call-logs (`ScreenshotStitcher.tsx:26`, `CallLogPhotos.tsx:27`), 15MB voice transcription (`transcribe-voice-note.functions.ts:56`). The main evidence uploader (`evidence.tsx`, `BatchDropzone.tsx`) enforces **file count (50), not size** — no byte check at all.

## Attorney

**9. Attorney role + invite — BUILT. Clio is not an auth path.** Role is granted on invite acceptance after verifying the JWT email matches the invited email (`attorney-invitations.functions.ts:160-186`). `lawyer-signup.tsx` self-registration alone grants no client data. **Clio is dead scaffolding**: `integrations.clio.callback.tsx:1-45` explicitly does not exchange the code for tokens, ignores `code`/`state`, and is marked pending Clio app approval. Direct invite is the only attorney access path today.

**10. Invite email with secure link — PARTIAL.** The invite row + token are created, but `createInvitation` sends **no email** — the survivor copies a link or uses a `mailto:` handoff (`share-with-attorney.tsx:113-124`). Real transactional email infra exists and is unused here (`src/routes/lovable/email/queue/process.ts`). A separate token read-only view does exist (`attorney.$token.tsx`).

**11. Timeline + original source files — BUILT.** `getClientCase` returns the full record; `getSignedEvidenceUrl` (`attorney-portal.functions.ts:1208-1232`) issues 30-min signed URLs after an access check, with GPS stripped (`:646-651`).

**12. Permanent "no legal conclusions" disclaimer — MISSING.** Zero disclaimer language in `src/routes/_attorney/*` or `attorney.css`. Permanent chrome only asserts encryption/logging (`_attorney.tsx:104-112`).

**13. Export zip/PDF — PARTIAL and mislabeled.** Survivor side has a real ZIP (`export-zip.functions.ts`) and a real generated PDF via pdf-lib (`court-packet.functions.ts`). The **attorney portal's "PDF" button actually produces a ZIP** of Markdown/CSV/JSON via JSZip (`payments.functions.ts:322-420,651`); the only true PDF there is browser print-to-PDF. Word (.docx) is genuine.

**14. Attorney sees their own consent grant — MISSING.** Nothing in `clients.$clientId.tsx` renders scope, date range, or expiry of the grant.

**15. Revocation — PARTIAL.** Instant cutoff genuinely works: every read path filters `status = 'active'` (18 sites in `attorney-portal.functions.ts`), checked fresh per call. **Missing** is the UI explanation that already-downloaded exports are unaffected — no such copy exists anywhere.

## Pushback

- **Item 5 is a security bug, not a feature request.** Quick Exit currently advertises safety it does not deliver. This should be fixed first, independent of the rest.
- **Item 8: 25MB conflicts with what's already shipped.** A flat 25MB cap would break screen-recording import (currently 200MB) and thread video. Recommend 25MB as the default for photos/documents, with explicit higher per-path caps for audio/video, rather than one global number.
- **Item 9/Clio: recommend deleting or clearly labelling the Clio callback.** It is a non-functional stub that reads as a working integration. It is not, and should not become, an auth path — email-verified invite is the correct trust anchor.
- **Item 3: don't restructure the entry model.** Attaching photos/voice directly onto `incidents` would duplicate the `evidence`/`voice_notes` tables and their hashing/provenance pipeline. Better: surface attach-photo/record-voice controls *inside* the journal entry form that write to the existing tables with `linked_incident_id` pre-filled.
- **Item 4: your requested sort may be wrong for survivors.** Sorting confirmed-before-approximate globally breaks chronology, which is the product's core value. Recommend chronological primary, precision only as a tiebreaker within the same sort date.
- **Item 13: fix the label, not the format.** The attorney "PDF" button producing a ZIP is a trust problem in a legal tool.

## Proposed remediation order

1. Quick Exit real sign-out (item 5).
2. Legal-use disclosure in onboarding + delete the two dead modals (item 2).
3. Attorney portal permanent disclaimer (item 12) and export-format relabel (item 13).
4. Unified upload-size policy with inline errors (item 8).
5. Consent-grant visibility for both sides (items 6, 14) + revocation/exports copy (item 15).
6. Persist the survivor role on signup and gate `_authenticated` on it (item 1).
7. Timeline precision tiebreaker (item 4); inline attach controls in journal (item 3).
8. Send the invite email through existing infra (item 10).
9. Decide Clio: delete the stub or mark it clearly unavailable (item 9).

Confirm the order and the pushback points you accept, and I'll write the implementation plan.
