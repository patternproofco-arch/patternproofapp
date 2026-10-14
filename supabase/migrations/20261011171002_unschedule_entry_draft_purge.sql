-- The published Lovable database muynotmkcmehxnkhffzl already has this job.
-- Removing the scheduling migration does not remove an installed cron job.
-- Apply through the reviewed production migration process, never from CI.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge-old-entry-drafts';
  END IF;
END
$$;
