ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS event_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_timestamp_kind text;

ALTER TABLE public.proposed_incidents
  ADD COLUMN IF NOT EXISTS sort_key_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_event_timestamp_kind_check'
  ) THEN
    ALTER TABLE public.evidence
      ADD CONSTRAINT evidence_event_timestamp_kind_check
      CHECK (
        event_timestamp_kind IS NULL
        OR event_timestamp_kind IN (
          'message_sent_at','email_date_header','email_received_at',
          'photo_taken_at','recording_created_at','survivor_confirmed_event_at'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposed_incidents_sort_key_kind_check'
  ) THEN
    ALTER TABLE public.proposed_incidents
      ADD CONSTRAINT proposed_incidents_sort_key_kind_check
      CHECK (
        sort_key_kind IS NULL
        OR sort_key_kind IN (
          'message_sent_at','email_date_header','email_received_at',
          'photo_taken_at','recording_created_at','survivor_confirmed_event_at',
          'screenshot_created_at','file_modified_at','file_created_at','ingested_at'
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS evidence_event_at_idx ON public.evidence (user_id, event_at);