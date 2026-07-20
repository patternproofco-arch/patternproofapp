
# PatternProof — Deep Audit (read-only)

Scope inspected: `src/routes/_authenticated.tsx`, `src/routes/_authenticated/onboarding.tsx`, `src/components/OnboardingModal.tsx`, `src/components/AppShell.tsx`, `src/components/FloatingNav.tsx` (508 LOC), `src/components/AmbientBackground.tsx`, `src/components/QuickExitButton.tsx`, `src/routes/_authenticated/dashboard.tsx` (573 LOC), `src/routes/_authenticated/journal.tsx`, `src/routes/_authenticated/evidence.tsx`, `src/lib/extract-incident.functions.ts`, route inventory (30 authenticated routes, ~8k LOC), the documented DB schema for `incidents`/`evidence`/`voice_notes`/`cases`, and the pasted design guidelines. **Not** inspected in this pass: `patterns.tsx` internals, `case-builder.tsx`, `share-with-attorney.tsx`, `AiSidekick.tsx` body, attorney portal shell, `pin-lock.tsx`, `settings-context.tsx`. Findings about those are flagged as inferences from filenames/history, not code reads.

---

## A. Ten biggest blind spots (severity × leverage)

1. **Two onboarding systems fight each other.** `_authenticated.tsx` redirects unonboarded users to `/onboarding` (a full route with PIN + state + 6 explainer cards), *and* `AppShell` renders `<OnboardingModal />` (its own privacy/ToS/state modal). A first-time survivor either sees the route and never the modal, or bounces if metadata desync happens. One path must die.
2. **No provenance / versioning on `incidents`.** Schema has `description`, `abuse_types`, etc., but no `source` (`survivor | ai_extract | imported_thread | bulk_paste`), no `confidence`, no `edited_at`/version log, no link back to the evidence row the AI extracted from. Court-defensibility (your core promise) is literally not represented in the data model.
3. **AI-drafted incidents look identical to survivor-authored incidents.** `extractIncidentFromImage` returns a draft, `journal.tsx` merges it into the same form and saves it as a normal row. There is no "AI-suggested, awaiting confirmation" state in the DB or the UI. This is the single biggest evidentiary risk in the app today.
4. **Quick Exit creates false safety.** `QuickExitButton` calls `history.replaceState(null,"","/")` then `location.replace(exitUrl)`. It does not: clear the tab title, blank the favicon, close other PatternProof tabs, clear the service-worker cache, wipe form state in memory, or leave the back-button clean across the whole session history (only the current entry is replaced). A monitored partner hitting Back once can land back on the app. The green "Exit safely" pill is also a *tell* on a shared screen.
5. **No safe-device / private-browser check before first write.** The `/onboarding` route explains "is this device safe?" as prose only. Nothing detects: shared account on the OS, saved passwords, autofill, browser sync, extensions, or a persistent session on a device the survivor named "shared." A survivor can create incidents from a spouse's laptop and never be warned.
6. **Destructive actions use `window.confirm`.** `journal.tsx` deletes with `confirm("Remove this record permanently?")`. Native confirm() is the most cognitively-loaded, easiest-to-misclick, least-undoable pattern possible on trauma content. No undo, no soft-delete, no 24-hr trash — you can nuke years of work with a fat-thumb tap.
7. **Nav overload masquerading as calm.** `FloatingNav.tsx` is 508 lines, 6 primary items + 8 overflow, plus a draggable desktop dock with expand/collapse/hide, plus Agent, plus AiSidekick FAB, plus FloatingRecordButton, plus QuickExit — five simultaneous floating surfaces on mobile. That is the opposite of "calm." Survivors with cognitive load will freeze.
8. **Dashboard is a marketing page, not a workspace.** `dashboard.tsx` (573 LOC) shows a "Step 1…Step 6" glass-card grid every single login, forever. There's no "resume where you left off," no "3 items awaiting your confirmation," no "you added 4 incidents last week, here's the next gap." Return visits feel like starting over — exactly what survivors dread.
9. **Onboarding asks for state to "surface legal resources," then largely doesn't.** State is captured in two places (`_authenticated/onboarding.tsx` + `OnboardingModal`) but I can't find a state-scoped resource surface in the routes list beyond `opra-helper.tsx` / `resources.tsx`. Either wire state through end-to-end or stop asking (it feels like data harvesting to a paranoid user, which every survivor is, correctly).
10. **`evidence-files` bucket keys reveal category via path.** `journal.tsx` uploads AI-scan files to `${user.id}/journal-ai/...`. Signed URLs are short-lived so this is low risk externally, but the *filename* survives in the download dialog / OS "Recents." Storage paths (and original filenames if kept) leak intent. Survivor downloads an evidence copy on a shared laptop → "IMG_journal-ai_2026…" in Downloads. No leak-scrub layer.

---

## B. Build now / validate first / later / cut

**Build now (weeks, not months, high-leverage, low regret):**
- Kill one onboarding path. Keep the full `/onboarding` route (richer, safer), delete `<OnboardingModal />` from `AppShell`.
- Add provenance columns to `incidents` (`source`, `source_evidence_id`, `confirmed_at`, `confidence`) and a "Draft — needs your confirmation" state in Journal.
- Replace `window.confirm` with an in-app undoable soft-delete (30-day trash).
- Real Quick Exit hardening: neutral tab title/favicon at all times (not just on exit), open new tab replacement instead of `history.replaceState`, warn on Ctrl-H and back navigation via `beforeunload` when unsaved.
- "Resume where you left off" panel at top of Dashboard, above the step grid. Steps grid collapses after first week.
- Nav diet: cut FloatingRecordButton (fold into Log Incident CTA), collapse AiSidekick into Agent route, hide desktop drag-nav behind Settings. Target: 1 floating surface on mobile.

**Validate first (needs Grace's judgment or user tests before code):**
- Whether to add a hard "shared device? go read-only" mode (safer, but confusing for solo-device users).
- Language choice: "Draft" vs "Suggested" vs "AI wrote this" for AI extractions.
- Whether Attorneys see the *provenance* labels (probably yes) and whether Organizations do.
- Iridescence: does it read as trust or as "AI slop"? A/B against a matte pearl surface with no gradients.
- Revocable-share UX (see below).

**Later (real value, but not this quarter):**
- Emergency-access designee (survivor names a trusted person who can recover a read-only export if survivor is unreachable for N days).
- Screen-reader-first pass on Timeline + Patterns.
- Cross-device sync of PIN/biometric enrollment.
- Multi-language (start Spanish only, US-market impact is huge for DV survivors).

**Cut:**
- The "END-TO-END ENCRYPTED" pill inside `FloatingNav` — Supabase Storage is server-side encrypted at rest, not E2E. This is a lie and will get flagged the day a technical attorney reviews the app. Either implement client-side encryption or remove the claim. This is not negotiable.
- The green "Exit safely" pill's *label*. Rename to something neutral and shrink it, or make it a keyboard-only shortcut with an unlabeled icon.
- Desktop draggable dock chrome (grip, hide, collapse, expand): 4 controls to move a menu is UI theater.
- "Iridescent" purple gradients on cards *and* background *and* buttons — pick one surface. Right now Hero, Dashboard cards, and Ambient all compete.

---

## C. Revised IA & survivor journey (proposed)

Current: 30 authenticated routes, 6 top-nav items, 8 overflow, dashboard with 6 "steps" that never advance.

Proposed top-level (5 destinations, no more):
1. **Home** — resume state, gaps, this-week summary.
2. **Log** — one entry point that fans out into: quick note, upload, thread paste, past-bulk, voice.
3. **Timeline** — chronological + pattern overlay switch.
4. **Prepare** — court packet, share with attorney, court dates (currently 3 separate routes).
5. **Safety** — settings, PIN, safe-device check, quick-exit config, emergency contact.

Agent lives as a *pane* on every screen, not a nav item. Search is a `/` shortcut. Resources / Abuser Tactics / Court Systems / Why Courts Struggle / Escalation Detector / OPRA Helper collapse into a single **Learn** overflow (currently 5 separate routes competing with the core loop).

First 5 minutes: safe-device check → quick-exit config → *skip everything else* → land on empty Log with a "paste one screenshot to see what we do" button. No PIN nag, no state selector, no ToS gate on the first screen (put ToS at first save).

First session goal: **one confirmed incident from one screenshot**, not "complete your profile."

Return session: Home surfaces "3 AI drafts awaiting your review" + "you have 4 texts from March you haven't imported."

"I need to share this tomorrow" journey: `/prepare` → pick date range → pick recipient (attorney/advocate/self) → pick scope (all / redacted / specific incidents) → generate preview → share via revocable link with expiry (default 7d) + view-log.

---

## D. Concrete visual direction (tokens & principles, not vibes)

Principles:
- **Calm authority, not iridescent AI.** Iridescence is currently the loudest voice; reduce to a single accent moment (the survivor logo mark itself) and let paper-white surfaces + serif do the work.
- **Provenance is visual, not textual.** Every incident card carries a 2px left-edge stroke: solid warm-neutral for survivor-authored, dashed lavender for AI-drafted-unconfirmed, solid teal once confirmed, dotted grey for imported/bulk. This is the "patterns become visible" metaphor without butterflies.
- **One elevation system.** Right now: glass, matte cards, gradient CTAs, iridescent bg, blurred nav — 5 material languages. Pick two: matte paper (`#FBFAF6`) for content, translucent obsidian (`rgba(26,23,20,0.85)`) only for the nav and only when it must overlay content.
- **Motion budget = 0 by default.** Only progress and confirmation animate. Respect `prefers-reduced-motion` at the token layer, not per-component.

Tokens (delta from current):
- Surface: `--paper: #FBFAF6`, `--paper-2: #F3EEE4`, `--ink: #1A1714`, `--ink-2: #3D3832`.
- Accent by identity: survivor `--iri-1: #C4A7FF` + `--iri-2: #A4FFEF` (used *only* on the mark and confirmed-state stroke); attorney `--navy: #14213D`; org `--sage: #8FB08A`.
- Semantic states: `--state-draft: #C4A7FF` (dashed), `--state-confirmed: #2F8D85`, `--state-shared: #5B7CC4`, `--state-archived: #A29E96`.
- Type: keep serif for H1/H2 only; body drops to `Inter` at 15/22. Kill the 22px card body — read the current dashboard on a 375px iPhone at 100% zoom and it's too dense.
- Radius: 12/16/20 only. Delete 24/28/100.
- Never full-fill cards with color; left-stroke only (matches your own written brand rule; the current Dashboard glass cards violate it).

Stage-by-stage feel:
- Arrival (landing): editorial, still, no motion. Iridescence *once*, in the mark.
- Safety setup: matte cream, no gradient, single accent per screen.
- Import: neutral. Progress = a line, not a spinner.
- Review/confirm: draft rows visually recede (60% opacity, dashed stroke) until confirmed → snap to full opacity + teal stroke. That transition is the app's one signature animation.
- Pattern discovery: information-dense, print-media aesthetic (which `patterns.tsx` reportedly already leans into — keep going).
- Professional share: switches surface to `--navy` chrome for the recipient view. Survivor sees "this is what your attorney sees" preview in the same chrome. Chrome-shift *is* the trust signal.

---

## E. Smallest de-risking implementation sequence

1. **Provenance migration** on `incidents` (+ `evidence.linked_incident_id` already exists). Backfill existing rows as `source='survivor'`. Zero UI change yet.
2. **Journal Draft state**: AI extractions insert with `source='ai_extract'`, `confirmed_at=null`. Journal list shows a "Needs your confirmation" strip at top.
3. **Soft-delete + undo** on incidents and evidence. Removes the worst foot-gun with almost no design surface.
4. **Kill duplicate onboarding.** Remove `OnboardingModal` from `AppShell`.
5. **Quick Exit hardening + neutral tab title/favicon always-on.**
6. **Nav diet** (cut FloatingRecordButton, fold AiSidekick into Agent route).
7. **Dashboard: "Resume + Gaps" strip** above the step grid; collapse step grid after 7 days of activity.
8. **Remove the "END-TO-END ENCRYPTED" pill** until it's actually true.
9. **Provenance visualization** (left-stroke system) across Journal / Timeline / Evidence / Court Packet.
10. **Revocable share links** with expiry + view log (leverages existing `share-with-attorney` route).

Each step ships independently and is reversible.

---

## F. Exact files / data areas implicated

- Onboarding conflict: `src/routes/_authenticated.tsx` (lines 48-55), `src/components/AppShell.tsx` (mounts `<OnboardingModal />`), `src/components/OnboardingModal.tsx`, `src/routes/_authenticated/onboarding.tsx`.
- Provenance: `incidents` table (schema), `src/lib/extract-incident.functions.ts`, `src/routes/_authenticated/journal.tsx` (form save at ~line 90), `src/components/IncidentCard.tsx`, `src/routes/_authenticated/timeline.tsx`, `src/routes/_authenticated/court-packet.tsx`.
- Soft delete: `journal.tsx` `remove()` (~line 115), `evidence.tsx` delete flow, add `deleted_at` to `incidents` + `evidence`.
- Quick Exit: `src/components/QuickExitButton.tsx`, `src/components/AppShell.tsx` (esc handler dup), root `<head>` in `src/routes/__root.tsx` (favicon/title).
- Nav diet: `src/components/FloatingNav.tsx`, `src/components/AiSidekick.tsx`, `src/components/FloatingRecordButton.tsx`, `AppShell.tsx`.
- Dashboard reshape: `src/routes/_authenticated/dashboard.tsx`.
- Encryption claim: `src/components/FloatingNav.tsx` lines ~157-175.
- Visual tokens: `src/styles.css`, `src/components/AmbientBackground.tsx`, `src/components/pp/*`.
- IA collapse (Learn cluster): `abuser-tactics.tsx`, `court-systems.tsx`, `why-courts-struggle.tsx`, `escalation-detector.tsx`, `opra-helper.tsx`, `resources.tsx`.
- Revocable shares: `src/routes/_authenticated/share-with-attorney.tsx`, `attorney-portal.tsx`, `attorney_client_links` table.

---

## G. Decisions only Grace must make

1. **"AI drafted this" language.** Draft / Suggested / Auto-filled / AI-assisted. Pick one word, we ship it everywhere.
2. **Encryption promise.** Client-side E2E (real engineering cost, breaks server-side AI extraction unless done carefully) *or* remove the pill and reword to "private, encrypted at rest." Cannot ship both.
3. **Onboarding rigor.** Long route (current `/onboarding`) vs 30-second modal. Long is safer, modal converts better; you get one.
4. **Attorney visibility of provenance.** Do attorneys see the AI-draft/confirmed distinction? (Argument for: honesty. Against: gives the other side ammunition.)
5. **Emergency access designee.** Survivors love it; it also creates a new attack surface if the designee is coerced. Ship or not.
6. **Iridescence budget.** Logo only, or logo + one confirmation-state accent, or keep as backdrop. This decides the app's face.
7. **Nav count.** Are you willing to cut FloatingRecordButton + AiSidekick from the shell? Both were built with intent; both fight the core loop.
8. **Trash retention.** 7 / 30 / 90 days for soft-deleted incidents.
9. **State-of-residence usage.** Wire through to resources properly, or stop collecting.
10. **Learn cluster.** Merge 5 educational routes into one `/learn` with tabs, or keep discoverable via search only.

---

**Not verified this pass (say so explicitly):** internal structure of `patterns.tsx`, `case-builder.tsx`, `attorney-portal.tsx`, `AiSidekick.tsx` behavior, PIN-lock timing/quality in `pin-lock.tsx`, whether existing RLS actually enforces the survivor-only invariants the guidelines require, and current copy in the AttorneySection/OrgSection landing components. I read the file list and imports, not the bodies. If you want any of those audited to the same depth, say which and I'll do a second pass before proposing changes.
