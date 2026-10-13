-- Lovable sync 2026-10-11: renumbered from Lovable drizzle 0023, which rescheduled the
-- 30-day entry draft purge. Main's 0013_preserve_unfinished_entries removes that job, so
-- running the original here would undo it. This copy only removes the job.
-- 0035_lovable_sync_reconcile re-asserts the same end state.
DO $$
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='purge-old-entry-drafts';
 END IF;
END;
$$;
