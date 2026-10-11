# Sharing integrity and founder operations

The launch changes target the published Lovable project f496a23a-1a8f-408f-b5e0-e96d5947d49c and its attached database muynotmkcmehxnkhffzl. The similarly named Supabase project obljoemiijkryjlxihic is an older database and must not receive production migrations.

Browser INSERT/UPDATE/DELETE on attorney_client_links and consent_grants are removed. Clio consent uses an owner-checked RPC with a row lock and atomic audit record. Consent grants have a dedicated one-way revocation RPC. Database triggers prevent service-role code from resurrecting expired/revoked rows, including a two-step paused-state bypass. Sharing changes are audited in the same transaction. Existing revoked/expired attorney relationships cannot be reopened by accepting another invitation; fresh sharing with the same recipient requires a separate new-grant design. Automatic subscription restoration cannot revive these links.

Attorney approval is held in attorney_access_applications, inaccessible for browser writes. All ordinary authenticated server functions check database roles and deny attorney accounts unless approved. Intake, role routing and admin operations use authentication without this approval prerequisite so a pending attorney can apply and a founder can review. Invitation acceptance requires approval even before an attorney role exists. Direct client-link writes are unavailable to browser callers. RLS gates attorney link reads on approval and lifetime; private.has_attorney_access enforces the same rules. Declining an attorney revokes existing links, invalidating collaborator and firm access based on those links. Approval alone grants no client access. No existing attorney is silently grandfathered.

The founder screen at /admin/operations requires the existing database admin role. It shows support requests, attorney review, actual registrations by role and email outcomes. Direct vetted invitations use a random 256-bit token stored only as a hash, expire after seven days, and require the matching confirmed account email. Claiming a token and granting the role are atomic. Invitation email failures are reported and a manual-share link is available.

## Evidence

- Local unit, TypeScript, build, SEO and dependency checks are recorded in the PR.
- scripts/run-launch-isolation-test.mjs runs PostgreSQL 17 through PGlite using a production catalog snapshot (schema/policies/privileges only, no records). Firm peer helpers are inert in this isolated-user fixture; it does not prove every firm collaboration configuration.
- supabase/tests/sql/launch_isolation.test.sql runs against the actual attached database in a transaction and rolls back all fictional users, records and audit events. It covers cross-account SELECT/UPDATE/DELETE and spoofed INSERTs on the six core tables plus consent_grants, positive owner reads, pending/approved attorney reads, expiry, permanent revocation, audit recording, and anonymous privileges. A successful rolled-back test does not deploy the migration.
- Browser fixtures cover the intake and founder tabs; they are not real authenticated-production journey evidence. Existing credential-dependent portal tests remain skipped locally. WebKit needs system libraries absent in this container; CI installs them.
- A fictional support ticket submitted to pattern-proof.tech on 2026-10-10 delivered to patternproofco@gmail.com at 15:25:59 UTC. Gmail classified it INBOX; SPF, DKIM and DMARC passed. Message ID: 1a1266bc5e083777. The production commit at that time was 964ab2aeda7d6641a1e1ce70336a82404649b693, showing notifications were already deployed, contrary to the pasted audit.

## Release verification

Apply the tracked migrations to the attached database, publish the tested commit, compare /version.json, rerun the SQL suite, verify signup email receipt and verify the new production routes. Never call local tests or provider acceptance proof of inbox delivery or certify broader launch readiness from this limited work.

## Additional verification and remaining blocker

- The CI configuration mismatch was reproduced locally and corrected by passing explicit inert Supabase build variables to the host wrapper. All three new browser cases pass against that CI-style production bundle.
- Additional SQL checks reject expired, reused and wrong-email founder invitations, browser execution of invite-claim RPCs and direct application approval.
- A fictional signup completed email confirmation and created its survivor role in production. The authentication confirmation email reached Gmail, but the separate founder signup alert did not appear in Gmail or email_send_log. Its delivery remains unverified. Notification preparation failures now produce a safe stage-specific record in the founder email queue; lookup/render/send regression tests pass. This diagnostic change is not proof of a delivery fix.
- The existing history scanner flags historical public Supabase/Stripe keys and plan lookup identifiers. No privileged credential was identified among the ten reported matches. The history scan remains red; the tip scan passes. No history rewrite or broad secret-scanner exception was applied.

## October 11 review update

The branch was updated with current main (`8f1e80a3`), retaining its migration
history. The branch's Drizzle migrations now follow main as
`0010_acl_client_update_guard_allowlist` and `0011_launch_consent_and_attorney_gate`;
the existing Supabase migration filenames are retained. Both lockfiles were
regenerated from the combined dependency requirements.

Signup alerts previously ran only on role insertion. If notification preparation
or delivery failed after the role was saved, later role checks returned without
retrying. Authenticated role checks now retry unreceipted alerts. Server-only
`signup_alert_receipts` persist successful/provider-suppressed outcomes; provider
idempotency keys cover concurrent requests. Existing roles are marked `skipped`
once when the receipt table is installed, avoiding historical-account emails on
login. Reapplying the migration preserves outstanding new alerts. Unconfirmed
accounts do not produce founder alerts. A `sent` receipt means provider acceptance,
not verified inbox delivery. Retry requires a subsequent authenticated role check;
there is no background email worker in this change.

Validation: 1,119 unit tests pass, including failure retry after role persistence,
successful/suppressed receipt handling, and safe lookup/render/write failures.
PostgreSQL 17/PGlite isolation tests, TypeScript, the production build, SEO (85),
and npm dependency audit (zero vulnerabilities) pass. SQL also verifies receipt
privileges, rollout exclusion and repeat-application behavior. Production email
receipt still requires a release check using a fictional, confirmed new account.
No email was sent and no production migration or deployment was applied during
this review.

Read-only inspection through the published Lovable project's database connection
found the active `purge-old-entry-drafts` job (ID 154), scheduled daily at 03:17 UTC.
Its original timestamp was absent from migration history. #206 now includes a
follow-up unscheduling migration; deleting its scheduling file alone does not
remove the installed job. The job remains active until that migration is applied.

Production already has a mailbox-based `attorney_applications` table with an
`invited_user_id` field and no `user_id`. The gate now uses the separate
`attorney_access_applications` table; legacy intake records and their statuses
remain untouched and confer no approval. The SQL regression fixture includes the
observed legacy schema and proves its apparent approval cannot grant access.
