
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS capture_method text,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS capture_notes text,
  ADD COLUMN IF NOT EXISTS primary_artifact_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS screenshot_count integer,
  ADD COLUMN IF NOT EXISTS video_duration_sec integer;
