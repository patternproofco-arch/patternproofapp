# PatternProof launch continuation — October 12, 2026

PR #207 is merged as main `30b8bea66d171652f28a995e40ef1a29a063ee03`. The hosted application and attached database still need a coordinated release. Source CI passing does not establish that release.

## Annotation privacy correction

The live database's evidence-review and checklist policies authorize an attorney/client pair rather than the original consent grant. A new grant can expose an earlier review of the same re-shared file. The new SQL regression reproduces this leak before applying the correction.

Evidence reviews now carry `link_id`; the server reads and upserts by grant and file. Legacy rows bind only when exactly one grant existed at their creation; ambiguous rows remain stored but inaccessible. Old grant records are preserved. Reviews and incident notes require currently owned, undeleted records selected in the current share and current case. A review with an unavailable linked entry is hidden entirely because its notes may describe that entry.

Restrictive database policies enforce the same boundaries on direct reads. Approval revocation and expiry apply immediately to a cached authenticated session. Checklist reads require their exact current grant. Court dates stay owner-only because no calendar sharing control exists. Annotation and message writes use the existing bounded server handlers; browser mutation privileges are removed. Clio unlink remains available, while direct updates to destination/grant metadata are denied.

Supabase migration `20261012020454_attorney_annotation_grant_boundaries.sql` is mirrored by Drizzle `0016`. Both runners must apply the same change only once. Draft PR #214 introduces a separate Drizzle history reconciliation occupying 0016–0035: if it merges first, renumber this mirror and extend its journal/snapshot chain before release. Do not run a divergent Drizzle ledger against the live database.

## Evidence

- Main handlers fail five of the eleven focused regression cases; corrected handlers pass all eleven.
- Full unit suite: 120 files, 1,192 tests pass. TypeScript and production Worker build pass with inert provider settings.
- ESLint on changed handwritten files has zero errors; existing `any` warnings remain. A clean main checkout has 5,698 repository-wide lint findings. The generated Supabase type file retains its generator formatting; repository-wide lint is not claimed as passing.
- PostgreSQL 17/PGlite suites pass, including legacy leak reproduction, old-versus-new grant isolation, deleted/removed records, approval revocation with cached identity, expiry, actor spoofing, message integrity, owner calendar reads and limited Clio updates. Migration replay is tested twice.
- The new annotation suite passes on the attached production schema in a controlled exception subtransaction. All DDL and synthetic records are rolled back. A catalog read afterward confirms the approval table and new helper are absent. To regenerate the exact rollback-only validation SQL: `node scripts/annotation-live-validation.mjs`.

## Production state and remaining work

Production target remains Lovable project `f496a23a-1a8f-408f-b5e0-e96d5947d49c`, database `muynotmkcmehxnkhffzl`. The draft purge job was paused using `cron.alter_job` on October 11; current readback shows zero active jobs with that name. Its tracked unscheduling migration has not run yet.

The approval/outbox tables and six #207 migration versions remain absent. No new production migrations or publishing occurred during this continuation. Publish must include the new grant-based review handlers when this migration is applied: older handlers use the removed pair-based unique key. Existing attorneys require founder approval after the gate is installed; deployment must not silently approve them.

The observed hosted version still reports `commit: unknown`, build `dca9ec2ef9d2`, October 10 build time, and contains hosting-injected `~flock.js` on private-route HTML. Lovable's project metadata reports main's merged commit, which does not prove the live artifact contains it. Keep the analytics privacy and version gates open. The Supabase management connector cannot access the attached project; live SQL checks used the authorized Lovable database connection.

The remaining inbox, payment-provider, Clio, credential-dependent portal and physical-device checks are listed in [the October 11 report](readiness-2026-10-11.md). They remain unverified; synthetic tests do not replace them.
