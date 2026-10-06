-- Grant reports: count completions by the actual completion date, and read each
-- report's period in a specified time zone.
--
-- Why: "Follow-ups completed" used org_follow_ups.updated_at (last edit). Editing an
-- old completed task moved it into a later reporting period. And periods were read
-- as UTC days, so work done on the evening of the last day (US time) fell into the
-- next period.
--
--  1. org_follow_ups.completed_at — set once when a task becomes done (or when staff
--     record the actual service date explicitly). Later edits don't move it.
--     Reopening a task clears it. Existing done tasks are NOT backfilled from
--     updated_at: their real completion date is unknown, so reports leave them out
--     of the completed count and say how many there are.
--  2. org_grant_report_drafts.period_timezone — IANA zone the period's calendar days
--     are read in. Existing drafts keep 'UTC', which is how they were computed.
--
-- Idempotent. Guarded so it is safe if org_follow_ups or org_grant_report_drafts
-- hasn't been created on this database yet.
-- Grace: apply on muy only. Do not apply from CI/agent.

-- 1. Completion date on follow-ups -------------------------------------------------

CREATE OR REPLACE FUNCTION public.org_follow_ups_track_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  done_states constant text[] := ARRAY['done', 'completed', 'closed', 'resolved'];
  now_done boolean := lower(coalesce(NEW.status, '')) = ANY (done_states);
  was_done boolean := TG_OP = 'UPDATE' AND lower(coalesce(OLD.status, '')) = ANY (done_states);
BEGIN
  IF NOT now_done THEN
    -- Reopened or never done: no completion date.
    NEW.completed_at := NULL;
  ELSIF NOT was_done THEN
    -- Just became done. Keep an explicit service date if staff gave one, else now.
    -- (On UPDATE, NEW.completed_at is OLD's value unless set, and OLD's is NULL
    -- because a not-done row never keeps one.)
    NEW.completed_at := coalesce(NEW.completed_at, now());
  ELSE
    -- Already done: an ordinary edit keeps the original completion date. Staff can
    -- still correct it by setting completed_at explicitly; clearing it is refused.
    NEW.completed_at := coalesce(NEW.completed_at, OLD.completed_at);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.org_follow_ups_track_completion() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.org_follow_ups') IS NULL THEN
    RAISE NOTICE 'public.org_follow_ups does not exist; skipping completed_at.';
  ELSE
    ALTER TABLE public.org_follow_ups ADD COLUMN IF NOT EXISTS completed_at timestamptz;

    COMMENT ON COLUMN public.org_follow_ups.completed_at IS
      'When the follow-up was actually completed (service date). Set when status becomes done; ordinary edits do not move it; cleared if reopened. Grant reports count completions by this, never by updated_at.';

    DROP TRIGGER IF EXISTS org_follow_ups_track_completion ON public.org_follow_ups;
    CREATE TRIGGER org_follow_ups_track_completion
      BEFORE INSERT OR UPDATE ON public.org_follow_ups
      FOR EACH ROW EXECUTE FUNCTION public.org_follow_ups_track_completion();

    CREATE INDEX IF NOT EXISTS org_follow_ups_completed_at_idx
      ON public.org_follow_ups (org_user_id, completed_at)
      WHERE completed_at IS NOT NULL;
  END IF;
END
$$;

-- 2. Reporting-period time zone on grant report drafts -----------------------------

DO $$
BEGIN
  IF to_regclass('public.org_grant_report_drafts') IS NULL THEN
    RAISE NOTICE 'public.org_grant_report_drafts does not exist; apply 20261004190000_org_grant_report_drafts.sql first, then re-run this file.';
  ELSE
    ALTER TABLE public.org_grant_report_drafts
      ADD COLUMN IF NOT EXISTS period_timezone text NOT NULL DEFAULT 'UTC';

    -- The app validates the IANA name; the database only bounds its length.
    ALTER TABLE public.org_grant_report_drafts
      DROP CONSTRAINT IF EXISTS org_grant_report_drafts_period_timezone_check;
    ALTER TABLE public.org_grant_report_drafts
      ADD CONSTRAINT org_grant_report_drafts_period_timezone_check
      CHECK (length(period_timezone) BETWEEN 1 AND 64);

    COMMENT ON COLUMN public.org_grant_report_drafts.period_timezone IS
      'IANA time zone the period''s calendar days are read in. Part of the approved content. Drafts created before this column existed were computed in UTC.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
