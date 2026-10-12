# Foundation staging rollout

Status: prepared locally; remote staging validation and deployment have not run. The managed environment has no staging database credential or deployment identity. Its checked-in Supabase binding does not establish a staging target. Do not use that binding as a substitute.

## Access needed

- Identify the staging Supabase project and hosting site/account. Configure the migration administrator credential and hosting credential through cloud environment secret settings; do not put them in source control or chat.
- Configure the staging database/provider destinations in the environment network policy. PostgreSQL connections also require the supported TCP grants. Preserve proxy and certificate trust.
- Confirm the destination is staging with fictional data, and identify the current deployed app version and migration versions before writes.

## Database sequence

1. Record the existing migration history, schema, policies and grants for `incidents`, `evidence`, `attorney_document_requests`, and the five disclosure tables. Compare the staging migration history with the repository. Review every pending migration; applying only the two new files does not establish the preceding schema is compatible.
2. Record a restorable staging backup or snapshot and the application version to restore. Resolve schema drift before applying migrations.
3. Apply pending migrations through the project's migration runner, including `20261010170000_record_foundation.sql` followed by `20261010171000_shared_record_corrections.sql`. Preserve migration-history bookkeeping. These migrations contain their own transactions; do not blindly rerun them or nest them in a runner's single-transaction mode.
4. Run `scripts/qa/foundation-staging-verify.sql` as the staging migration administrator. It runs in a read-only transaction, verifies RLS/grants/RPC settings and enabled triggers, and lists policy definitions for review without reading survivor narratives. Example with a securely configured database binding: `psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/qa/foundation-staging-verify.sql`. Do not print the connection URL or enable shell tracing.
5. Review the reported policies against staging's existing grants. The verification script is a structural check, not proof of all cross-account behavior.

The scripts `foundation-db-fixture.sql`, `foundation-db-checks.sql`, `shared-correction-db-checks.sql`, and `foundation-db-concurrency.sh` are for the disposable local test database only. They must not run on a remote Supabase project: they create mock auth roles/tables and assume fictional fixed IDs.

## Fictional staging workflow checks

Use two survivor accounts and a professional recipient, all designated fictional QA accounts. Use their real staging authentication and storage paths, without the browser mock-session harness.

| Action | Required result |
| --- | --- |
| Save an undated note and image/audio/PDF | Visible after reload; date remains unknown; no automatic vendor processing |
| Interrupt upload or preservation, then retry | Clear unconfirmed state; no additional stored record on retry |
| Correct a private note | Prior account appears in owner-only history; the other survivor and professional cannot read it |
| Share an exact selection, then add a private upload | Recipient sees only the deliberate selection |
| Correct an item under an active share or pending invitation | Substantive rewrite rejected; separate private correction remains possible |
| End access, then correct | Recipient loses access; private correction succeeds and retains earlier words |
| Save a request draft with a file selected | Professional cannot read draft text or selected file |
| Ask for help or report unavailable | Distinct outcome; no draft text/file disclosure |
| Submit two requests concurrently | Both deliberate file selections retained; no lost update |
| Submit after expiry/revocation or with another account's file | Rejected; no new disclosure or partial response |
| Export with unconfirmed suggestions and a long conversation | Suggestions excluded; confirmed context complete; export is not labelled filed, served or admitted |

Record date, build identifier, migration versions, account aliases, expected/actual result, and redacted diagnostics. Keep QA artifacts free of credentials and real records.

## Physical-phone checks

Run the same core flows on a physical iPhone/Safari and Android/Chrome. Check camera/file pickers, keyboard overlap, interrupted upload recovery, microphone permissions, recording without remote speech recognition, quick exit, screen-reader labels/navigation, and corrections/revoked sharing. Browser viewport emulation does not satisfy this check. Record device/OS/browser and assistive-technology versions.

## Deployment

Keep `PATTERNPROOF_AI_POLICY_APPROVED` unset or false. Use the identified hosting provider's existing deployment workflow with staging bindings; the generic checked-in Wrangler app name does not identify an authorized live deployment.

After database, fictional workflow and device checks pass, deploy the compatible application to the named target and repeat authenticated save/share/revoke smoke checks using fictional accounts. Record the actual build and deployment identifier. Production deployment requires an identified production target and compatible production migration state; a staging result alone is insufficient.

If validation fails, keep the previous app deployment serving and resolve the defect before promotion. If restoration is necessary, use the recorded backup and matching app version. Do not drop revision tables or discard captured history as a shortcut rollback.
