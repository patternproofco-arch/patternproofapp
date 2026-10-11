# CPS Worker Portal: spec and three-way review (v1, draft)

Status: DRAFT for founder review. No code, migration or database change exists yet.

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
