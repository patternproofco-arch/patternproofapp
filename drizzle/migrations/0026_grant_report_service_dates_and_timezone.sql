CREATE OR REPLACE FUNCTION public.org_follow_ups_track_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  done_states constant text[] := ARRAY['done', 'completed', 'closed', 'resolved'];
  now_done boolean := lower(coalesce(NEW.status, '')) = ANY (done_states);
  was_done boolean := TG_OP = 'UPDATE' AND lower(coalesce(OLD.status, '')) = ANY (done_states);
BEGIN
  IF NOT now_done THEN NEW.completed_at := NULL;
  ELSIF NOT was_done THEN NEW.completed_at := coalesce(NEW.completed_at, now());
  ELSE NEW.completed_at := coalesce(NEW.completed_at, OLD.completed_at);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.org_follow_ups_track_completion() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.org_follow_ups') IS NOT NULL THEN
    ALTER TABLE public.org_follow_ups ADD COLUMN IF NOT EXISTS completed_at timestamptz;
    DROP TRIGGER IF EXISTS org_follow_ups_track_completion ON public.org_follow_ups;
    CREATE TRIGGER org_follow_ups_track_completion BEFORE INSERT OR UPDATE ON public.org_follow_ups FOR EACH ROW EXECUTE FUNCTION public.org_follow_ups_track_completion();
    CREATE INDEX IF NOT EXISTS org_follow_ups_completed_at_idx ON public.org_follow_ups (org_user_id, completed_at) WHERE completed_at IS NOT NULL;
  END IF;
END
$$;
ALTER TABLE public.org_grant_report_drafts ADD COLUMN IF NOT EXISTS period_timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE public.org_grant_report_drafts DROP CONSTRAINT IF EXISTS org_grant_report_drafts_period_timezone_check;
ALTER TABLE public.org_grant_report_drafts ADD CONSTRAINT org_grant_report_drafts_period_timezone_check CHECK (length(period_timezone) BETWEEN 1 AND 64);
NOTIFY pgrst, 'reload schema';