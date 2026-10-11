-- Drafts remain private until their owner saves or discards them. Disable the
-- historical cron job on deployments where the earlier migration already ran.
DO $$
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='purge-old-entry-drafts';
 END IF;
END;
$$;
