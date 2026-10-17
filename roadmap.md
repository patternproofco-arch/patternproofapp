# Roadmap

- [x] Homepage social/search metadata: og-home.png + og:image/twitter:image in index.tsx
- [x] Fix Supabase type drift: applied unapplied migrations (security_audit_fixes, incident_evidence_links); set bucket size limits; typecheck + build clean
- [x] Answer: is the DV org portal complete? (reported — flow is survivor→advocate, no invite emails, org portal is aggregate-only)
- [ ] Optional follow-ups if wanted: advocate invite email delivery; org-level client visibility for org owners; real PDF export in advocate case view
- [ ] Publish to push og-home.png + metadata to live URL
- [x] Database security constraints locked in: keep no-policy tables service-role-only, no generic user_id policies, no RPC revocation without proof of no callers, no index drops
- [x] Verified read-only: the two owner-check helpers have no app callers and are already service-role-only; no destructive change needed

- [x] Release blocker: removed all production test-account email bypasses (deleted src/lib/test-accounts.ts; MFA, role routing, advocate profile, subscription gating); regression tests in src/__tests__/no-test-account-bypass.test.ts
- [ ] Pre-existing failing check: landing page missing "Sample · demo data · not a real record" folio preview (media-timeline-flow.test.ts)
- [x] Confirm Lovable Cloud/Supabase is enabled and healthy for this project
- [ ] Track .env (6 publishable Supabase names only) so published builds get sign-in values; update conflicting tests; add loud prod build warning; auth bootstrap failure state; verify with typecheck/tests/build. Do not publish, no DB changes.
- [x] Org grant report (counts only, <5 bucketed) in partner dashboard
- [x] Structured evidence requests: attorney panel + survivor Requests tray (draft/send/pass; staged until send)
- [x] Drafts to review page for AI-transcribed/extracted text
- [x] Invite portal: already complete (create/list/resend/revoke, survivor picks items)
- [ ] Live two-account privacy check on pattern-proof.tech (needs confirmed survivor + subscribed attorney test pair)

## Open (Sep 30)
- [ ] Live two-account screen check — blocked: practice attorney 2-step sign-in rejects test sign-in; practice survivor not onboarded
- [ ] Real-inbox discreet invite test — needs user to send one invite to their own address from the attorney portal
- [x] Master court packet / exhibit binder page (/binder/$clientId)
- [x] Request answers → draft entry in Drafts to review (note + transcript/photo text, survivor approves)
- [x] Upload auto soft drafts: photo/audio/video → pending proposed_incidents for /drafts (soft claims; survivor approves)
- [x] Drafts accept → timeline + binder consistency; survivor transcript/OCR review tray (soft claims; no share bypass)

## Oct 10
- [x] Sharing-record lockdown (no reopen/extend/widen from browser) — verified at database level
- [x] Remaining Sept–Oct database updates applied (marketing_leads skipped)
- [x] Founder dashboard /admin; attorney request page /attorney-apply; approve/decline + direct invite
- [x] Published; test help request + attorney request alerts delivered to founder Gmail
- [ ] On-screen survivor→attorney re-check — needs Grace signed in on attorney account (2-step sign-in)
- [ ] Signup alert proof — approve the test attorney request in /admin to trigger it

## Open (Oct 12)
- [x] Paste 1 Section 0 run (read-only), output saved to Files
- [ ] Paste 1 Section 1 — HELD: written for PR #214 code, which is not in this project yet; running it now locks every attorney out of the live site
- [ ] Paste 1 Section 2, Verifier smoke test, publish — after Section 1
- [ ] Paste 2 (attorney profile lock), Paste 3 (test attorney trial) — after Paste 1 + publish
- [ ] Approve fictional test attorneys in /admin — after all three pastes
- [ ] End-to-end pilot for each upload format (consent, processing, Journal, revocation, privacy, survivor-approved Timeline) — after pastes
- [ ] Grace: delete real-survivor "New survivor signup" emails in Gmail; turn on Lovable 2FA; set AI database access to ask each time; remove unneeded project members

## Oct 16
- [x] "Enable Supabase for this project" — checked: the backend is already enabled, managed and live (not paused); nothing to turn on, no change made
## Oct 16 (later)
- [x] Typecheck clean and 1,392 tests pass. Code (#245) uses grant-scoped `link_id` on attorney_evidence_reviews (unique on link_id+evidence_id) — the correct design
- [x] Production DB is muynotmkcmehxnkhffzl (NOT obljoemiijkryjlxihic, which is an old database and must not receive production migrations). Verified read-only on Oct 17: `link_id` + grant-scoped unique index, the 10 pending-migration tables, private.annotation_record_shared / confirmed_account_email, and both grant policies all exist on muy. Code matches production. Note: supabase_migrations.schema_migrations on muy has no rows >= 20261009 (migrations were applied by SQL paste, not tracked)
- [ ] Jev AI: attorney entry-link suggestions (file ↔ documented entry, confirm to apply)
- [ ] Jev AI: record-type grouping of shared files in the review queue (display-only)
- [ ] Jev AI: survivor draft tidy-up (possible duplicates, missing date/place flags; confirm everything)
- [ ] Jev AI: missing-items nudge on evidence requests (match request text to shared files)
- [ ] Drive/OneDrive scan: per-user connector (google_drive, microsoft_onedrive) so Jev can identify relevant files even with unhelpful names — needs client configured + per-user OAuth + storage table
- [x] Attorney-invite funnel (Oct 17, from Lovable's read-only audit). The invite-page application/pending UX landed on main separately (InviteApprovalStep); PR #251 adds the server-side hardening on top:
  - Approving an attorney now sends a plain, case-free notice email (best effort, never blocks the review)
  - Invite email is pinned to the exact invitation id (was "newest pending for this recipient")
  - `peekInvitation` (unauthenticated) trimmed to attorney email/name/expiry — no case names, other-party name or scope flags
  - A newer invite to the same attorney + case revokes the older pending one (a narrowed share no longer leaves the wider link live)
- [ ] Open gaps in main's accept-invite page (found by independent review, not yet fixed): (a) the accept effect has no in-flight guard — a token refresh mid-request can fire a second accept and show a false error; (b) declined screen says "reply to your review email" but no rejection email is sent; (c) state changes are not announced to screen readers (no role=status/alert); (d) a signed-in account whose email differs from the invitation can still file an application — add a wrong-account screen; (e) the typed name/bar number live in sessionStorage, so they are lost when the confirmation email opens in a new tab
- [ ] Decisions parked on purpose: (a) invite expiry keeps running during approval — extending it would exceed what the survivor consented to; survivor must re-send. Show survivors a "waiting on attorney approval" status. (b) Free-first-client entitlement not changed — first nine attorneys already get a 90-day trial; revisit pricing as its own decision. (c) Attribution (which survivor invite produced which attorney signup/subscription) still missing; needs a column or join table on muy
- [ ] Jev prerequisites: TYPESAFE_API_KEY as a server secret; documented AI policy review (provider retention/training/subprocessors) before PATTERNPROOF_AI_POLICY_APPROVED=true; route Jev calls through the same policy gate; send minimal fields only, within share scope
