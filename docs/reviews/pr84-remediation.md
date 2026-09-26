# PR 84 review remediation

## Fixed

- Reconciled current main without restoring removed test-account role/MFA bypasses.
- Role/database failures and unsupported roles display a retry screen; no survivor fallback. Role requests time out. Account changes remount role/MFA/settings/PIN state and ignore late responses.
- Professional redirects happen before survivor providers mount. Legitimate dual-role accounts retain their survivor space with its lock.
- Lock-setting failures stay locked with retry. Direct onboarding navigation cannot bypass an existing PIN/recovery screen.
- Caseload labels are fetched only for an authorized, specifically shared case. Withdrawn/expired grants never fetch current case labels; content-only grants do not expose an unrelated case.
- Case reads and packet exports share link/invitation checks: revoked status, revoked_at, expired/malformed timestamps, missing referenced invitations and lookup failures deny access. Exact expiry is denied.
- Grant badges honor revocation timestamps and expiry. Caseload/invites revalidate every 15 seconds while visible, on focus/online, and on manual refresh. Hidden pages clear snapshots, and failed refreshes hide old details. Server authorization is authoritative between refreshes.
- Added DOM tests of the actual layout/provider/refresh hook and handler tests with synthetic database I/O. Source-string tests for PIN/redirect/onboarding behavior were replaced by runtime coverage.
- Isolated Vitest from the server-function bundler so handler tests execute handler bodies, not RPC stubs.
- Synced npm/Bun lockfiles (including main's preexisting drift) and restored the manifest placeholder required by the credential guard test.

## Local evidence

- Clean npm install succeeded.
- Bun frozen-lockfile install succeeded.
- 40 test files, 352 tests passed.
- TypeScript passed.
- Production bundle built using inert client configuration; no production database was accessed.
- SEO: 85 checks passed.
- Local Playwright browser download failed with corrupt/truncated archives; browser suite is not claimed as locally passed.

## Remaining release evidence

This change is not whole-product real-data certification. No production migrations, PIN clears, or real survivor data were used. Deployed RLS/storage behavior, real authenticated synthetic-account journeys, physical iPhone checks, and other open verification/release PRs remain separate gates. A withdrawn recipient may retain information already read or downloaded; these changes deny subsequent authorized reads, not erase prior copies. Keep real-data NOT SAFE until those gates are independently verified.
