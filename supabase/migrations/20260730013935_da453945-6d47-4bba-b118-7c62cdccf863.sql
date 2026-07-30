-- Evidence: restore date certainty options
ALTER TABLE public.evidence ALTER COLUMN date DROP NOT NULL;
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS date_range_start date,
  ADD COLUMN IF NOT EXISTS date_range_end date,
  ADD COLUMN IF NOT EXISTS anchor_label text,
  ADD COLUMN IF NOT EXISTS exif_choice text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS voice_caption text,
  ADD COLUMN IF NOT EXISTS voice_caption_audio_url text;

CREATE OR REPLACE FUNCTION public.evidence_validate_dating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date_precision NOT IN ('exact','approximate','unknown') THEN
    RAISE EXCEPTION 'evidence.date_precision must be exact, approximate or unknown';
  END IF;
  IF NEW.exif_choice NOT IN ('none','kept','stripped') THEN
    RAISE EXCEPTION 'evidence.exif_choice must be none, kept or stripped';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_validate_dating_trg ON public.evidence;
CREATE TRIGGER evidence_validate_dating_trg
  BEFORE INSERT OR UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.evidence_validate_dating();

-- Threads / source documents: video frame provenance
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS frame_interval_sec numeric;
ALTER TABLE public.thread_source_documents
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'screenshot',
  ADD COLUMN IF NOT EXISTS frame_time_sec numeric;

-- Resumable mixed-media intake batches
CREATE TABLE IF NOT EXISTS public.intake_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  kind_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  queued_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_batches TO authenticated;
GRANT ALL ON public.intake_batches TO service_role;
ALTER TABLE public.intake_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own intake batches"
  ON public.intake_batches FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER intake_batches_touch
  BEFORE UPDATE ON public.intake_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS intake_batches_user_status_idx
  ON public.intake_batches (user_id, status, created_at DESC);

-- AI content-type suggestions, kept separate from the factual record
CREATE TABLE IF NOT EXISTS public.evidence_classification_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  suggested_kind text NOT NULL,
  confidence numeric,
  rationale text,
  status text NOT NULL DEFAULT 'suggested',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_classification_suggestions TO authenticated;
GRANT ALL ON public.evidence_classification_suggestions TO service_role;
ALTER TABLE public.evidence_classification_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own content-type suggestions"
  ON public.evidence_classification_suggestions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER evidence_classification_suggestions_touch
  BEFORE UPDATE ON public.evidence_classification_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS evidence_class_sugg_user_status_idx
  ON public.evidence_classification_suggestions (user_id, status, created_at DESC);