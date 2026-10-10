DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-old-entry-drafts';
    PERFORM cron.schedule('purge-old-entry-drafts', '17 3 * * *', $job$DELETE FROM public.entry_drafts WHERE updated_at < now() - interval '30 days'$job$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Entry draft purge not scheduled: %', SQLERRM;
END
$$;