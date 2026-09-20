# PR 94 verification followup

Status: changes implemented on a separate review branch; NOT approved for deployment.
Owner: Codex. Original reviewed commit: 7578b593684c9c7151599acf4c8a565bafd71e11.
Last verified action: 2026-09-20 UTC, 332 tests passed including six tests executing the actual verification migrations in an isolated PostgreSQL runtime (PGlite) with fictional records. TypeScript passed. The final production build passed. The six PostgreSQL migration tests were rerun after the final suspension-notice change and passed.
Next action: review CI and run the authenticated verification journeys using fictional staging accounts.
Followup target: 2026-09-21. No automatic followup is scheduled by this document.

## Changes

* Browser credentials can no longer write attorney profiles, invitations, links or collaborator rows directly. Existing authenticated server functions remain the write path.
* Both professionals on a shared attorney case must have current verification. Messaging and client summaries now check engagement and verification. Manual time entries use the same case authorization helper.
* Suspension revokes the suspended person's collaborations on other attorneys' cases, plus firm collaborator rows in the existing owner/admin cascade. SQL grant creation locks the same attorney or organization row used by suspension to prevent post-suspension grant creation from stale checks.
* Every recorded bar jurisdiction must be verified and unexpired. Missing verification expiry and database lookup failures deny access. Six calendar months are used in SQL and JavaScript.
* The blanket legacy organization auto-verification was removed. Historical access-request approval does not establish current verification. Existing organizations and attorneys require review before activation.
* Added browser-facing restrictive database policies for attorney link/message/collaborator reads and advocate link reads; existing permissive policies do not override them.
* Both invitation directions require an explicit survivor confirmation. Existing pending invitations can be confirmed from the sharing screen.
* Added in-app suspension notices, an attorney status and engagement renewal panel, and an admin review panel under the existing admin organization requests route.
* Corrected missing invitation write types and verification RPC signatures. Added behavioral authorization regressions and actual SQL permission, suspension and transaction rollback tests.

## Release blockers and limits

* No production migration or merge is authorized by this change. The initial PR 94 migration was edited because it remains unmerged; if it has been applied to any environment independently, reconcile that environment before deployment. Do not assume editing a migration file updates an existing database.
* The PostgreSQL test fixture represents the relevant pre-PR tables and privileges. It is not a full Supabase staging reset and does not certify production RLS, storage, auth or runtime deployment.
* Fictional staging credentials and administrator access are needed for end-to-end reviewer approval, paid Pending denial, survivor consent, expiry, mid-session suspension, downloads/exports, and restoration without silently reinstating old grants. Existing portal browser tests skip without those credentials.
* Non-attorney staff still require an approved verification model. The conservative inherited attorney gate does not authorize paralegals by inventing bar credentials. Do not open staff access until this is resolved.
* Proof metadata restrictions do not establish proof-file confidentiality. A private proof upload/review workflow, storage policy tests and verified separation from AI ingestion remain required before accepting documents.
* Reviewer search currently lists at most 100 accounts. It is a basic review control, not a complete operational review queue.
* Review public bearer-link sharing, all remaining service-role endpoints, OAuth callbacks, outstanding signed URLs, and org roster access against the intended Verified policy. This patch does not claim an exhaustive security certification.
* Password reset, auth-error improvements and the full share-target search experience remain separate work. A missing or failing check must keep the release blocked.

## Browser verification

Existing Playwright suite: 15 passed, 12 skipped, 9 failed.
Seven failures could not launch WebKit because this runtime lacks its system libraries. Two Chromium homepage assertions caught ERR_EMPTY_RESPONSE for Google Fonts and Google Tag Manager; trace locations identify those external URLs. The twelve authenticated portal tests were skipped because fictional account credentials were absent. These are not counted as passes. The new authenticated screens have not been certified end to end.

The final TypeScript and production build checks passed. No production records were read or modified to perform the database tests.
