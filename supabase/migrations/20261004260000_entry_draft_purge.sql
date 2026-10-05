-- Unfinished entries are removed 30 days after they were last touched.
--
-- The app already ignores and removes an old draft when it is opened. This also removes drafts
-- nobody ever opens again (an abandoned account), so sensitive text isn't kept indefinitely.
-- Uses pg_cron when the project has it; if not, nothing is scheduled and the in-app removal still
-- applies. No error either way.
--
-- Grace: apply on muy only. Do not apply from CI/agent.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-entry-drafts';
    PERFORM cron.schedule(
      'purge-old-entry-drafts',
      '17 3 * * *',
      $job$DELETE FROM public.entry_drafts WHERE updated_at < now() - interval '30 days'$job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Entry draft purge not scheduled: %', SQLERRM;
END
$$;
