# Stop the scheduled entry draft purge

Read-only inspection of the database attached to Lovable project
`f496a23a-1a8f-408f-b5e0-e96d5947d49c` on October 11, 2026 found an active
`purge-old-entry-drafts` cron job (job ID 154). It runs at 03:17 UTC daily and
executes `DELETE FROM public.entry_drafts WHERE updated_at < now() - interval '30 days'`.
The original timestamp was absent from `supabase_migrations.schema_migrations`;
that absence is not evidence that the job was never installed.

The follow-up migration `20261011171002_unschedule_entry_draft_purge.sql`
unschedules every job with that exact name. It leaves unrelated jobs and draft
records alone. It is safe to repeat and safe on databases without pg_cron;
permission or execution failures propagate instead of being hidden.

Apply it through the reviewed migration process to the published project's
attached database `muynotmkcmehxnkhffzl`, then verify:

```sql
SELECT jobid, jobname, active
FROM cron.job
WHERE jobname = 'purge-old-entry-drafts';
```

The query must return zero rows. No production migration was applied during this
review; the job remains active until that release step is completed. Removing a
job cannot recover drafts it already deleted. The application still removes
old drafts when opened; changing that behavior and adding explicit draft deletion
controls remain separate product decisions.

Validation: local PostgreSQL 17 through PGlite, with a minimal cron function
fixture, covered an installed job, repeated application, unrelated-job preservation,
and a database without the cron schema. Existing entry-draft unit tests pass.
The fixture does not execute the production pg_cron extension.
