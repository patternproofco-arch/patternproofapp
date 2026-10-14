# PatternProof launch continuation — October 14, 2026

Main advanced from `b757124f4cfd31287311e55147e9b83067a18b91` (#214 reconciliation) to `93619a2498ca8f4e5553e96f9068665198fee0ce` (#232 mixed-role routing and strict professional approval) during this pass. Both branches preserve the stricter approval middleware. The first production readback reported the earlier `b757124f` commit, build `4522806b0903`, built October 13. Approval and signup-outbox tables now exist on the attached production database. The draft purge remains inactive. These observations supersede the production-state sections of the October 11–12 reports.

## Reconciled annotation fix (#218)

The expanded history occupies Drizzle 0000–0041. The annotation fix is now appended as `0042_attorney_annotation_grant_boundaries`, with a snapshot linked to 0041. Its Supabase counterpart is `20261014134914_attorney_annotation_grant_boundaries.sql`, generated with the CLI and ordered after the October 13 migrations. The earlier unapplied 20261012 migration is replaced. Existing history is preserved; tests check both copies and the full chain.

Current-main integration passes 129 unit files / 1,300 tests, TypeScript, the production Worker build, the database isolation suites, and the reconciliation bring-up suite. Changed handwritten files lint with zero errors and four existing type warnings. Chromium, Android emulation and iOS WebKit pass 57 browser cases; 12 credential-gated cases skip. The grant-bound annotation suite passes again against the current production schema in an exception subtransaction: all migration DDL, synthetic records, role/outbox effects and approval changes are rolled back.

The production review table still lacks `link_id`, and the annotation helper is absent. This is compatibility evidence, not an applied privacy fix. Coordinate this migration with its updated server handlers; older handlers use the removed pair-based upsert key. Preserve historical reviews and require current grant, approval, selected records, case membership and undeleted ownership. Do not automatically approve accounts during rollout. The review handler also checks the current attorney role: a focused regression reproduced access after that role was removed, then passed with the correction. The direct-database suite now covers role removal with a cached identity as well.

## Reconciled source verification and widget removal (#219)

The branch retains current main's foundation safeguards and includes the MCP build manifest in source provenance. Environment files inside source roots are excluded as well as root environment files. Current-main integration passes 130 unit files / 1,292 tests and TypeScript; a new manifest regression covers the expanded provenance input. The feedback widget remains entirely omitted; public Google Analytics keeps its existing allowlist and private-route guard. The final browser run passes all 60 cases with retries disabled; 12 credential-gated cases skip.

The live marker does not yet contain a source digest. After the provenance change is published, run `node scripts/verify-published-source.mjs https://pattern-proof.tech` from the exact released checkout. It verifies source inputs, not migration state or provider configuration.

## Release dependencies

Private-route production HTML still contains hosting-injected `~flock.js`. No callable hosting analytics setting has been found. This remains a launch privacy gate independent of either source fix. GA history-event behavior needs provider verification; signed-in portal credentials, actual founder-inbox receipt, billing provider behavior, Clio and physical-phone checks remain open.

The production migration ledger is Drizzle-based; the latest recorded hash observed matches main's 0020 foundation migration. The earlier bring-up and foundation hashes also match tracked files. The Supabase ledger does not record those October changes. Inspect the host's migration runner before recording or applying additional versions; do not fabricate ledger entries or run two migration runners independently.

Production target: Lovable `f496a23a-1a8f-408f-b5e0-e96d5947d49c`, attached database `muynotmkcmehxnkhffzl`. No new production DDL, approval decisions, email sends, payments or Clio operations occurred during this validation.

The first simultaneous build pair exhausted local memory; builds were rerun sequentially. An intermittent WebKit fixture failure showed 403/CORS responses from the inert backend hostname despite HTTP mocks. Fictional SDK calls now use the local origin before route interception, with explicit mock CORS/preflight responses. The affected flow passes eight repetitions with retries disabled; page-error assertions are retained.
