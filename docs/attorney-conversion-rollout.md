# Attorney conversion implementation

Status: code implemented for review; rollout disabled. Last verified September 19, 2026.
Owner: Grace for release and offer decisions; implementing reviewer for code and migration review.
Next action: review this branch and its migration against the pending professional verification changes in PR #94.
Follow up: September 20, 2026. No production release deadline has been set.

## Approved pricing and value

Grace revised the attached strategy's recommended prices during implementation.

| Plan | Monthly USD | Active cases | Seats | Additional value |
| --- | ---: | ---: | ---: | --- |
| Solo | 69 | 5 | 1 | Scoped chronology, attorney notes, source review, authorized exports |
| Legal Aid / Founding | 49 | 5 | 1 | Same Solo workspace at an individually approved discount |
| Practice | 229 | 25 | 5 | Shared workspace, pooled cases, scoped team access |
| Firm | 369 | 50 | 10 | Larger team and case pool with the same consent boundaries |

Prices live in `src/lib/attorney-offer.ts`. Checkout verifies USD, exact amount, monthly recurrence, and the approved discount before creating a payment session. New versioned lookup keys avoid repricing existing subscriptions. Enterprise remains a separate agreement; no unlimited capacity is promised. Organization referral access remains free.

## Implemented

1. `/attorneys` continues redirecting to canonical `/for-attorneys`. The landing page now includes the manual/app comparison, workflow, fictional PDF, kit, plan/value comparison, privacy FAQ, and client invitation template.
2. `/pricing` uses the same new price/value component. Before activation the offer is explicitly labeled upcoming. `/lawyer-signup` gains real account creation when the offer is enabled. Email confirmation, access review, MFA, and existing sharing checks remain distinct.
3. `/security-privacy` explains provider processing, revocation limits, downloaded copies, location metadata, encryption limitations, and the absence of legal guarantees.
4. `/resources/attorney-kit` generates a four-page printable PDF with a matching worksheet, fictional timeline, invitation template, branding, clickable links, and a QR code to the public attorney page. `/resources/attorney-sample` generates the fictional example alone. Neither endpoint reads customer data.
5. A first-case workspace has no expiry or card requirement. Server-owned approval is required. One permanent matter/grant/case claim prevents reset by closing, deleting, detaching, or exchanging a case. Client-scoped reads still require an active, unexpired sharing grant. Additional matters and accepted shares are capped in database triggers, including reopen paths and shared firm capacity.
6. Kit delivery is one requested email. Four additional emails at days 2, 5, 9, and 14 require an unchecked consent box and a separate inbox confirmation POST. A link scanner GET cannot enroll anyone. Existing leads are never retroactively enrolled. Unsubscribe and suppression are rechecked at send time. Due work uses a database lease and stable provider idempotency keys; late execution spaces emails instead of sending a backlog at once.
7. Aggregate `attorney_conversion_metrics` is service-role only. It reports kit requests, confirmed follow-ups, approved workspaces, first cases started, and active new-plan paying accounts. Requests are not downloads; these counts are not attributed conversion rates. No email open pixel or case-content analytics were added.

## Required before activation

The migration is not applied and Stripe products/prices are not created by this branch. No marketing emails, external outreach, or charges have been sent or initiated.

* Resolve existing production launch blockers, including issue #59 and Gate 1. Review the professional verification implementation in PR #94. The conversion approval table is a commercial offer review record, not a replacement for professional identity verification or its suspension/expiry rules.
* Reconcile overlapping work in PRs #82 (case caps), #85 (marketing copy), and #94 (professional verification). Their code was not silently merged here.
* Review and apply `20260919210000_attorney_conversion.sql` in an isolated staging database first, against the complete real migration history. Defaults are off. Browser accounts cannot write settings, approvals, claims, or nurture tables. Direct public writes to marketing leads are removed in favor of the rate-limited server function.
* Create new Stripe monthly USD prices with lookup keys `attorney_solo_v2_monthly` (6900 cents), `attorney_legal_aid_v2_monthly` (4900), `attorney_practice_v2_monthly` (22900), and `attorney_firm_v2_monthly` (36900). Check webhook synchronization and cancellation behavior with fictional staging accounts. Do not edit old price objects.
* Reviewers with authorized service access approve an offer using `approved_at` and `approved_by`. A discounted account also needs `discount_approved_at`. Signup never sets those fields. Align this review operation with the professional verification workflow before enabling real accounts.
* Confirm signup email redirect allowlists include the attorney signup return URL. Test email confirmation, MFA, profile setup, approval, opening the free matter, accepting a client-scoped invitation, attaching the share, notes, download, revocation, additional case paywall, cancellation, and deletion.
* Nurture requires a real `MARKETING_POSTAL_ADDRESS`, an operating email provider, an authenticated scheduler calling the existing queue processor, and explicit enablement of `nurture_enabled`. Scheduler provisioning is not performed here. The queue processor remains service-key protected. Do not expose that key to a browser. PR #88 contains separate cron work to reconcile.
* Only after review should a release owner set `enabled = true`. `payment_environment` defaults to live; use a separate staging database for sandbox testing. The new ten-seat allocation is granted only to the matching live Firm plan.

## Validation and limits

Verified locally: TypeScript check, production build, 292 unit tests, and 22 PostgreSQL behavioral assertions in an isolated PGlite fixture. The fixture executes the actual new migration, but does not reproduce the entire production schema or all RLS policies. Database assertions cover permanent claims, denied extra cases, paid limits, reopening, browser privilege denial, seat limits, and worker leases.

The environment blocked Chromium startup with an operating-system socket permission error. Browser layout and live end-to-end workflows are not certified by this work. Existing tests and a build are not proof that production is safe.

To reproduce:

```sh
npm test -- --reporter=dot
npx tsc --noEmit
npm run build
npm install --prefix /tmp/pp-dbtest @electric-sql/pglite
PP_PGLITE_MODULE=/tmp/pp-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/qa/attorney-conversion-db.mjs
```

## Strategy items handled deliberately

The attachment's assertion that no pricing/attorney pages existed was outdated. Existing routes were improved instead of duplicated. Unsupported competitor prices, conversion benchmarks, testimonials, guaranteed privilege, zero-provider-access statements, automatic admissibility, and “only platform” claims were not published. Existing hashing and audit/export code was retained; this work does not certify chain of custody.

Outreach, social publishing, referral rewards, custom branding, research integrations, and other roadmap ideas are not activated. Use this reel CTA after the offer is enabled: “Download the free evidence intake kit and explore your first case free in PatternProof. Link in bio.” Until then use: “Download the free intake kit and see a fictional source linked timeline. Link in bio.”
