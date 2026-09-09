# Release pass: publish, prove the portals, replace the dead sample case

Four things you asked for, in the order they have to happen. One of them (a real
iPhone in a hand) I cannot do myself — that part becomes a checklist for you,
and I will fix whatever it turns up.

## 1. Close old download links, then publish

Right now a download link handed to an attorney keeps working for up to an hour
after you take their access away. That is fixed before anything goes live:

- Export and evidence downloads move behind a short-lived link that is checked
  against live access each time it is opened, so taking access away stops the
  old link immediately.
- Regression test: issue a link, revoke access, confirm the old link fails.

Then publish the current commit and confirm the live site reports the same
version as the code that was built.

## 2. Walk the three portals on the live site

With clearly fictional accounts (marked as test data, on the shared live
backend — real writes, so everything is labelled and cleaned up afterwards):

- Attorney: sign up, onboarding, trial, receive a survivor invite, open the
  matter, see only what was shared, build a packet, then have the survivor
  narrow and revoke access and confirm every path closes.
- Advocate and organization: invite, acceptance, scoped case view, packet,
  revoke. Confirm being in an organization on its own never shows a survivor's
  evidence.
- Cross-account: two survivors, two attorneys, one advocate, one organization —
  swapped record ids, stale and revoked invites, direct calls, old download
  links. Any leak is a stop-the-line fix plus a permanent test.

## 3. A real pilot case in place of the dead /sample-case

A working, read-only walkthrough built from fictional records: a photo, an
audio note, a document, a handful of dated events, a packet you can open, and a
visible "access removed" step. Every page that currently points at the dead
link is repointed. The case is clearly marked as an example, never presented as
a real person.

## 4. Account deletion, exercised for real

Run the written deletion procedure against a fictional survivor account, then
prove nothing survives: records, files, drafts, invites, grants, exports and
previously issued download links all fail afterwards. The written procedure is
corrected wherever reality differs from it.

## 5. iPhone — what I can and cannot do

I can test Safari behaviour in a simulated iPhone browser and fix what shows up
there: photo and audio pickers, HEIC photos, iPhone voice memos, camera capture,
upload from the Photos app, orientation, and the recording controls. I cannot
hold a physical phone. So I will:

- fix everything reproducible in simulated Safari,
- then hand you a short numbered checklist to run once on your own iPhone.

Mobile is not called ready until that checklist comes back clean.

## What else is needed before real users

Called out honestly, not fixed in this pass unless you say so:

- Real-media proof: your own photo, voice memo and scanned PDF run through the
  pipeline, with the read-back text and transcript checked by a human.
- Wording review in the attorney matter view — a few labels still read as
  judgements rather than counts.
- Someone answering the deletion and support inbox, since deletion is by
  request rather than a button.
- A named cleanup owner for the fictional accounts created during this pass.

## Technical notes

- Signed URLs: replace direct `createSignedUrl` handoffs in
  `export-zip.functions.ts`, `attorney-portal.functions.ts`,
  `attorney-public.functions.ts` and `payments.functions.ts` with a
  short-TTL link plus an access re-check on fetch.
- Pilot case: new public route replacing `/sample-case`, served from fixed
  fictional data (no auth, no live rows), linked from the homepage and the
  professional pages.
- Deletion: execute `docs/account-deletion-procedure.md` step by step against a
  fictional uid and record the verification counts in the certification report.
- Checks each pass: `bunx tsgo --noEmit`, `bunx vitest run`, `bun run build`,
  `bun run test:e2e`, plus RLS/security scans on touched paths.
- `docs/portal-certification-report.md` is updated with evidence-backed
  PASS / FAIL / MANUAL QA REQUIRED and a single verdict.
