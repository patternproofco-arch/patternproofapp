# Survivor invites attorney funnel: audit findings and fix plan

Read-only audit, Oct 17 2026. No files, data, or settings were changed. Every finding below comes from reading the code. Tests were read but not run, and the live site was not exercised.

## Scorecard

| # | Step | Verdict | Key evidence |
|---|---|---|---|
| 1 | Survivor selects, previews, creates invite | PASS (code) | share-with-attorney.tsx:64-70, 147-188; attorney-invitations.functions.ts:64-76, 105-125; invitation-scope.test.ts |
| 2 | Invitation email | PASS in code; delivery not checked | share-with-attorney.tsx:190-203; invitation-email.functions.ts:155-187. Risk: the server picks the recipient's newest invite, but the duplicate-send key belongs to one specific invite (:156-165, 185) |
| 3 | Signed-out click, sign up, return | NOT VERIFIED | accept-invite.$token.tsx:69-82 keeps the token in the confirmation link; no test covers this path |
| 4 | Manual approval and waiting screen | FAIL | Name and bar number are collected (accept-invite.$token.tsx:155-175) but never sent; no application is created (:74-78); a failed approval shows "Linking your account..." forever (:64, 138-143) |
| 5 | Invite expires while approval is pending | FAIL | 30-day clock never pauses (attorney-invitations.functions.ts:41, 275, 304); the survivor has no way to renew with the same records |
| 6 | Acceptance, exact scope | PASS: never widens, can narrow | Database checks in 20261014220000_accept_share_confirmed_email.sql:38-96; records deleted since the invite are dropped (invitation-scope.test.ts:90-105) |
| 7 | Free client review without a subscription | FAIL | isAttorneyEntitled requires a subscription (payments.functions.ts:316-333); accepting goes straight to /subscribe (accept-invite.$token.tsx:59-63) |
| 8 | Upgrade path | PASS for checkout entry; FAIL as a free-then-paid journey | subscribe.tsx:30-46; live checkout not checked |
| 9 | Attribution | FAIL | Invite signup skips referral recording (AuthPage.tsx:65-66 vs accept-invite.$token.tsx:74-78); no link from survivor invite to signup or subscription |

Note: attorney_survivor_invites runs the opposite way (attorney invites survivor). Its tests do not cover this funnel.

## Must fix before real survivors invite attorneys

1. When an invited attorney signs up, file their approval application automatically, using the invite's email and the bar number they entered.
2. Replace "Linking..." with a calm waiting screen: "Your access is being reviewed. Your client's invitation is held for you." The survivor sees a "waiting on approval" status.
3. Pause the invitation's expiry clock while approval is pending, or let the survivor renew with the same records already selected. The renewed invite must never include more than the original.
4. Decide on free review (needs your call, Grace): either let an invited attorney view that one shared client read-only without paying, or remove any copy that promises free review. Today the code makes them pay.
5. Make the invite email send to that exact invitation, not to the recipient's newest one.

## Should do soon
- Record which survivor invite brought in each attorney signup and subscription. Store counts only, with no survivor content.
- Add an end-to-end test that runs the whole invite journey.

## Minimal safe test with fictional data
Fictional accounts only (@patternproof.test), on the preview, no real records:
1. Fictional survivor shares 1 entry and 1 file with a new fictional attorney email. Check that the email is logged as sent.
2. Open the link signed out, sign up, and confirm. Check that you land back on the invite.
3. Check that the waiting screen appears and that the application is in /admin.
4. Approve in /admin. The attorney accepts. Check that the share holds exactly 1 entry and 1 file, and nothing more.
5. Run the free-review and subscribe steps, using Stripe test mode only.
6. The survivor revokes. Check that the attorney loses access on the next load.
7. Repeat step 1 with a 1-minute expiry, still pending, to check the expiry behaviour.

## Technical details
- Files to change: src/routes/accept-invite.$token.tsx, src/lib/attorney-invitations.functions.ts (pending state and renewal), src/lib/email/invitation-email.functions.ts (look up by invitation id), src/lib/payments.functions.ts or attorney-portal.functions.ts (scoped free-review rule, if approved), plus one database update to pause expiry.
- Tests: extend invitation-scope.test.ts, add accept-invite pending and renewal tests, and add one e2e spec.
- Roadmap: add this audit's fix list to roadmap.md once Build mode is on (plan mode can't edit it).
