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
