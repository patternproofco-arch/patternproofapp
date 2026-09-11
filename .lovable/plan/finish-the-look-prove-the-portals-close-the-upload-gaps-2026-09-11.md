# Finish the look, prove the portals, close the upload gaps

Three things in one pass: every page on the locked Paper & Ink system, every portal walked and proven with fictional accounts, and the "everything you upload gets read and offered to your timeline" promise made true for all file types.

## 1. Design: finish the restyle, page by page

The locked system (paper background, ink text, indigo/oxblood accents, Newsreader + Source Sans 3 + IBM Plex Mono, binding stitch, flat, max 3px radius, no shadows) is applied to the header, footer, marketing pages and the survivor shell. The remaining screens still carry older styling.

Work through them in groups, checking each against the same rules:

- Survivor: dashboard, timeline, evidence, case, case builder, journal, patterns, search, settings, voice notes, live recording, court packet, court dates, court ready, communications, message imports, share-with-attorney, share-with-advocate, access, calendar, feedback, contribute, onboarding, legal documents, court systems, OPRA helper, agent screens, evidence review.
- Attorney: setup, caseload, clients list and client detail, conflict check, team, trust, billing, subscribe, feedback.
- Advocate and organization: advocate setup, advocate cases list and detail, org portal, org signup, partner access, org feedback, admin org requests.
- Entry and token pages: sign in, sign up, choose role, login, all invite-acceptance pages, connect, demo, sample case, version, unsubscribe, support, resources, self-help guide.

A page counts as done when: no leftover purple/lavender, no gradients, no rounded pills, no drop shadows, no Inter, dates and IDs in the mono face, and Exit safely in its own green.

## 2. Portals: prove they work

Walk each portal end to end with clearly fictional accounts and record the result:

- Attorney: sign up, onboarding, trial, accept survivor invite, open client, see only shared items, notes, export, then survivor narrows scope and revokes — old links stop working.
- Advocate: invite, onboarding, survivor grant, scoped case view, packet, scope reduction, revocation; a second survivor stays invisible.
- Organization: org onboarding and oversight, and the key proof that belonging to an organization alone never reveals a survivor's evidence.
- Cross-account: swapped IDs, stale invite links, expired download links, refresh and back-button — every unauthorized attempt must fail.

Anything that fails gets fixed, then covered by a permanent automated test so it cannot silently break again.

## 3. Uploads: close the reading gaps

Today a batch upload already pulls photo/video details, transcribes audio and video, and offers timeline entries for review. Two gaps:

- Documents (PDF, Word, scanned pages, text, CSV) are read only when opened one at a time, not as part of a normal upload. Wire document reading into the same upload flow so a dropped PDF or Word file comes back with its text ready for review and its own timeline suggestions.
- Single-file uploads outside the batch dropzone skip parts of that chain. Route them through the same steps.

Every result stays a suggestion the survivor confirms or discards. Nothing is added to the timeline automatically, and no file is described as anything other than what it contains.

## 4. Unobvious things worth adding

Short list, in the order I'd pick them:

- A one-page "what happens to a file after you add it" screen showing read, hashed, suggested, awaiting your review — turns invisible work into visible trust.
- A gap report: stretches of time with nothing recorded, so a survivor can see where memory is thin before a hearing rather than after.
- A one-tap re-generate of an existing packet after new records are added, with a plain record of what changed since the last one.
- Offline capture that survives a closed browser and finishes uploading later (the queue exists; make its state visible).
- A "practice run" mode for the first session, so someone can try adding a record without it becoming part of their real record.
- Delivery receipts on invite emails so a survivor knows the professional actually received the link.

I can fold any of these in; they are not part of the three blocks above unless you say so.

## Notes

- Physical iPhone and Android testing still cannot be done from here. I will simulate iOS Safari conditions and say plainly that on-device sign-off remains outstanding.
- The database is shared between the preview and the live site, so any test accounts will be clearly fictional and cleaned up.
- Nothing gets published until the checks and walkthroughs pass.

## Technical notes

- Extend the batch upload chain in `BatchDropzone.tsx` to call `extractDocument` for document MIME types before `proposeTimelineFromEvidence`, and mirror the chain for the single-file path in `evidence.tsx`.
- Restyle by extending the scoped Paper & Ink layer in `src/styles.css` for `.pp-app-shell` personas plus per-route cleanup; remove legacy token usage rather than overriding it.
- Add Playwright coverage for attorney/advocate/org journeys and isolation, and Vitest coverage for document extraction inside the upload chain.
- Run `bunx tsgo --noEmit`, `bunx vitest run`, `bun run build`, `bun run test:e2e`, plus RLS/security checks on touched paths; update `docs/portal-certification-report.md`.
