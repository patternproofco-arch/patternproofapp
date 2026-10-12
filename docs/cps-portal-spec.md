# CPS Worker Portal: spec and three-way review (v1, draft)

Status: DRAFT for founder review. Migrations and the access layer are written on this branch but NOT applied to any database. Routes, email, worker viewer and screens are not built yet.

## Decisions already made
- Verified CPS worker **accounts** (new `cps_worker` role), not link-only.
- Founder approval plus a government/agency email before a worker can do anything (same gate as attorneys: `attorney_access_applications`).
- The **CPS worker starts the invitation**; the survivor decides everything after that.
- Read-only. Watermarked. Survivor-visible access log. No downloads, no messaging in v1.

## Why worker-initiated invites need extra guard rails
The attorney flow already lets a professional invite a survivor
(`attorney-survivor-invites`). For CPS the same shape carries three extra risks:
1. **Impersonation.** An abuser poses as CPS to phish a survivor into opening her records.
2. **Compliance pressure.** A survivor may feel she cannot refuse a government agency, and an abuser who reads the invite email learns that CPS is involved.
3. **Harm from the records themselves.** What she shares can be used against her (for example a failure-to-protect finding) and cannot be taken back once an agency holds it.

## Flow
1. Worker applies at `/cps-apply`: name, agency, county/state, agency email (must match an allow-listed government domain list that the founder maintains), supervisor name and phone. Status `pending_review`. The founder calls the supervisor line listed on the agency's public site, not the number the worker gave, then approves. Rejected and pending workers can do nothing.
2. Approved worker creates an invitation: survivor email only, plus an optional case reference number. **No free-text note, no bulk invites, a daily cap per worker.** The message is a fixed template.
3. The invitation email is discreet. Neutral subject (for example "A secure message is waiting"), no mention of CPS, children or abuse in the subject or preview. The body says only that a named, approved professional asked to request records, and that nothing is shared unless she signs in and agrees. The existing email and quick-exit conventions apply.
4. The survivor signs in or signs up on her own, then sees a screen showing: the worker's name, agency and approval date; "this is a request, not a requirement from PatternProof"; what the worker will be able to see (nothing until she picks); a plain note that records given to an agency may not be recoverable; a prompt to talk to her lawyer first (with a one-tap "message my attorney" if she has one linked).
5. She picks **exact items** (reuse `SharePreview` / exact-selection sharing), sets an expiry (default 30 days, max 90), and confirms with her password (reuse the fresh-sign-in rule from assistant access).
6. Worker sees a read-only viewer of only those items, watermarked with name, agency and timestamp. No bulk export, no download, no print stylesheet.
7. Survivor can end access in one tap at any time. Expiry and revocation are enforced in RLS and in server code, as for attorneys.
8. Survivor sees an access log (who, when, which item) and gets a notice on first open.

## Data model (new, additive)
- `app_role` += `cps_worker`.
- `cps_access_applications` (mirror of attorney applications; service-role writes; applicant reads own row).
- `cps_invitations` (worker_user_id, survivor_email, token_hash, status, expires_at, no free text).
- `cps_client_links` (worker_user_id, client_user_id, status, expires_at, revoked_at, exact scope arrays, case_ref).
- `cps_access_log` (link_id, worker_user_id, item_kind, item_id, viewed_at); survivor can read, nobody can edit.
- `private.has_cps_access(worker, client)` mirroring `has_attorney_access`: approved AND active AND not revoked AND not expired.
- RLS: RESTRICTIVE select policy like `attorney_client_links`; no client-side INSERT/UPDATE/DELETE grants; state changes through server functions only.
- Server module `cps-access.server.ts` mirroring `attorney-access.server.ts`: fail closed, route params never trusted, scope narrowed to the exact selection.

## Explicitly out of v1
Downloads or PDF export, messaging, bulk invites, share-all, worker search for survivors, AI features for workers, any worker-visible "she declined" signal.

## Review 1: CPS worker point of view
What they need: a fast way to get a survivor's evidence, with little time.
- Strength: inviting the survivor themselves saves a phone-tag round trip.
- Pain: view-only with no download means they cannot attach records to their own case file. Risk is that they screenshot. Mitigation: a watermark, and a clearly labeled "case summary" page the survivor chooses to share, written to be quotable.
- Pain: the approval step slows them down. Mitigation: a published turnaround target, and a founder-maintained allow-list so a county-wide agency domain approves quickly.
- Gap: workers often act on a hotline report before the survivor knows. The portal must not be a way to look up whether a survivor has an account. Uniform response on invite regardless of whether the email exists.

## Review 2: Survivor point of view
What she needs: safety, control, no surprises, nothing used against her.
- Risk: an abuser who sees the email learns CPS is involved. Mitigation: neutral subject, no children or CPS words in the preview, the same quick-exit and discreet-mode rules the app already uses. Offer "do not email me, give me a code to type at a trusted device" later.
- Risk: she feels she must say yes. Mitigation: the screen says plainly that she can ignore it, that declining is not reported to the worker by the app, and that she can ask her lawyer first. Avoid urgent wording and countdown timers.
- Risk: impersonation. Mitigation: she sees the agency, the approval date and a "verified by PatternProof" mark that only an approved worker gets; invites from unapproved senders never send.
- Risk: she shares too much or too fast. Mitigation: no select-all, mandatory exact selection, a preview of exactly what the worker sees, a password re-entry.
- Risk: irreversibility. Mitigation: an upfront notice that once an agency has seen or recorded information she may not be able to take it back; shorter default expiry; one-tap revoke.
- Gap: children's information (names, schools) in her records. Prompt her that items mentioning children will be visible to the worker, and let her mark items "keep private" as the app already does.

## Review 3: Family-law attorney point of view
What they need: no harm to the case, no waiver or privilege surprises, a clear paper trail.
- Risk: a client hands unvetted records to CPS before her lawyer sees them, creating admissions or inconsistencies. Mitigation: the "talk to your lawyer first" step, a notification to her linked attorney (only if she opts in) that a CPS invitation arrived, and the share goes through the same exact-selection record the attorney already sees.
- Risk: privilege. Items marked attorney-client privileged or attorney notes must be excluded from CPS scope by default and cannot be selected. Enforce in the scope builder, not just the UI.
- Risk: a competing record. The CPS access log and the exact set shared must be exportable to the survivor and her attorney, so counsel can show what the agency received and when.
- Gap: discovery and subpoena. Counsel will ask what PatternProof retains about CPS access. Retention for the log must be stated and consistent with `docs/account-deletion-procedure.md`.
- Gap: the AI-extracted entries. Unconfirmed AI-written entries must not be shareable with CPS until the survivor confirms them (matches the MCP review rule).

## Open questions for the founder
1. Which agency domains do you accept at launch (state, county, tribal)?
2. Who reviews applications, and what is the target turnaround?
3. Do you want a survivor-side switch "never accept CPS invitations" in settings? (Recommended.)
4. Should a CPS worker be able to see that an invitation was opened, and nothing else?
5. Legal review: counsel should confirm the notice wording and whether PatternProof has any reporting duty when a survivor's records mention child abuse.

## Build order after approval
1. Migration: role, tables, RLS, function, tests mirroring `attorney-authorization`, `honour-share-expiry-rls`, `grant-no-future-sharing`.
2. `cps-access.server.ts` plus tests.
3. `/cps-apply`, founder approval in the founder operations screen.
4. Invite creation, email template, survivor acceptance route (`/cps-invite/$token`).
5. Worker viewer with watermark, access log, survivor log and revoke.
6. Settings switch, attorney notice, limits.

---

# Addendum (research): verification, social workers, opt-out switch, legal duties

Research notes only. Nothing here is legal advice; items marked VERIFY need confirmation by counsel or a primary source.

## A. Which email domains do CPS workers actually use?
No public ranked list exists. What the agency sites show:
- Many state agencies use their own .gov or the state's .gov (azdcs.gov, utah.gov, ny.gov, illinois.gov).
- County-run states (child welfare administered by counties) use county domains, which can be .gov, .us or .org.
- Privatized states use nonprofit contractors with .org or .com addresses.
- Only verified U.S. government organizations can register a .gov (get.gov / CISA). It is a strong signal of "government", not of "child welfare".
- CISA publishes the full .gov registry daily (`cisagov/dotgov-data`, `current-full.csv`, CC0). It lists each domain with organization name, type (State, County, City, Tribal...), and state.

Build the allow-list from that file rather than from guesses: filter by type and organization-name keywords (children, family, social services, human services, DCFS, DCS, DSS, child protection), then have a human review the result once. Re-run weekly and diff. (I could not download the file from this sandbox: the proxy blocks raw.githubusercontent.com. A build step can fetch it in CI.)

## B. Social workers
Three different people share the title:
1. **Agency caseworkers (CPS/child welfare).** Many hold no social work license, so a license check cannot be the gate. The agency email is the gate.
2. **Licensed independent or clinical social workers** (private practice, school, medical, court). State boards publish license lookups; ASWB links to about two dozen state lookup pages; no single national API exists, and third-party aggregators cover only a handful of states. License lookup is semi-manual.
3. **Guardians ad litem and court social workers.** Not CPS. Often use court or non-government email. Manual review.
Add `professional_type` to the application so the survivor sees what kind of professional is asking, and so scope can differ by type.

## C. Instant approval: what is safe to automate
Do not let Claude be the approver. It cannot verify identity, application text can carry prompt injection, and one false approval gives an impersonator an official-looking invite to send to a survivor. Use deterministic checks to decide, and use Claude only to summarize and flag.

**Tier 1, seconds, no human.** All must pass:
- one-time link sent to the work email and clicked (proves control of that mailbox);
- domain is on the curated child-welfare allow-list;
- not a lookalike (edit-distance and punycode checks against the allow-list), not on the deny-list;
- per-IP and per-domain rate limits.
Result: approved with "new account" limits (for example 3 invites a day for 14 days). The survivor is told "verified government email at <agency>", never "verified CPS" (any employee of that agency passes).

**Tier 2, minutes to hours, AI-assisted, human taps approve.** Other .gov/.us/county/tribal domains, and licensed social workers. The system gathers evidence (CISA registry entry, state license board link, the agency's public staff page) and Claude writes a short summary with flags. Claude has no approve permission; the founder or a trained reviewer does.

**Tier 3, manual.** Non-government email (nonprofit contractors, GALs, court staff): agency letter or call-back to the number published on the agency's own site, never the number the applicant gives.

Also: re-verify the email every 90 days; auto-suspend on a bounce; a survivor "report this request" button feeds an instant worker suspension.

## D. Item 3: survivor-side "never accept CPS invitations"
Recommended design, reusing the assistant-access pattern (`assistant-access.server.ts`):
- Stored server-side (auth app metadata or a service-role-only table), read fresh on every invite, failed read means "blocked".
- Three states: **Ask me** (default), **Block all**, and per-invite decline. Default is "Ask me" so a survivor who wants help is not silently cut off; the setting is offered during onboarding and in Safety settings.
- When blocked, the invite email is **not sent** and the worker gets the same response as for any other email. No signal that an account exists or that she blocked.
- Turning the block **off** needs her password or a very recent sign-in, same as turning on outside assistants, so someone with brief access to her phone cannot weaken it.
- Declining an invite is never reported to the worker.
- Edge: a person with no account yet receives the invite (no setting exists). The invite page offers "never contact me" for that address.
- Tests mirror the assistant-access tests: blocked means no email and no row visible to the worker; failed read means blocked; turning off requires fresh sign-in.

## E. Item 4: legal duties to confirm with counsel
Likely relevant (VERIFY each):
1. **Federal CSAM reporting, 18 U.S.C. 2258A.** Providers must report apparent child sexual abuse material to NCMEC's CyberTipline once they have actual knowledge; the statute does not require monitoring. Survivors upload photos and video, so PatternProof should have a written procedure for the rare case staff learn of such material (support ticket, abuse report, legal process). Counsel should confirm whether PatternProof is a "provider" and what the preservation duties are.
2. **State mandatory reporting.** As of 2015, 18 states and Puerto Rico had universal reporting (any person must report suspected child abuse); other states list professions. VERIFY the current list and whether a software company's staff count in any state. DV advocates are generally confidential with an exception for child-abuse reports (WSCADV guidance), which also affects the existing advocate portal.
3. **Notice to survivors.** Terms and Privacy should say, in plain words, what PatternProof staff will never read, and the narrow circumstances in which staff could be obligated to report.
4. **Records that mention children.** Decide whether CPS shares may include items naming minors and how the survivor is warned.
Best way to get this done: one engagement with a lawyer experienced in both DV technology and child welfare (NNEDV's Safety Net project and your state DV coalition can refer), producing (a) a written staff procedure, (b) approved notice wording, (c) a state-by-state table of reporting duties. Do this before any CPS invitations go live.

## Build status (this branch)
Done and tested (under a stand-in runner; see below):
- Migrations `20261011190000_cps_role` and `20261011190100_cps_access`, mirrored in `drizzle/migrations/0016`, `0017`.
- `cps-verification.ts` tier rules, lookalike check, invite caps, 90-day clamp.
- `cps-access.server.ts` approval and link checks, exact-scope builder (leaves out unconfirmed AI entries, attorney-privileged files, private or undecided items, deleted items, anything not hers), batch view log.
- `cps-applications.server.ts` apply, instant tier-1 decision, founder approve/reject/suspend. The work mailbox is proven by the account's own confirmed email (sign up with the work address and click the link).
- `cps-invites.server.ts` create (daily cap per worker, 3-a-day cap per recipient, identical reply whether or not the address exists or blocks, timing padded), peek, accept (password re-check, exact picks, 30-day default, 90 max), decline (never reported), revoke.
- `cps-invite-policy.server.ts` survivor opt-out switch.
- `cps-viewer.server.ts` worker case list and read-only case view; items re-checked on every open; every view logged first.
- Discreet email `cps-invitation` (subject "A secure message is waiting"; no agency, child or sender wording).
- Server functions `cps.functions.ts`; screens `/cps-apply`, `/cps-portal`, `/cps-review` (founder), `/cps-invite/$token`; survivor card in Settings (block switch, grants, who opened what, end access).
- `routeTree.gen.ts` edited by hand for the four routes (regenerate with the normal build).

Still open:
- Domain list seeding job from the CISA registry (the allow-list table is empty until you seed it, so nothing auto-approves yet; everyone goes to review).
- Notice to her linked attorney; mailbox re-check job at 90 days; AI-written reviewer summary (reviewers currently see plain facts only).
- File previews for shared evidence (the viewer shows titles and dates only).
- Worker-side role routing: a `cps_worker` account is not recognized by the main app's role switcher; workers use /cps-portal directly.
- Counsel review of wording and reporting duties (see addendum E).

Not verified: the SQL has not been run against Postgres; the full test suite, typecheck and lint have not been run because dependencies cannot be installed in the build sandbox. New tests were run under a small stand-in runner only. Run `bun run test`, typecheck and the SQL on a Supabase branch before merging.
