
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS perceptual_hash text,
  ADD COLUMN IF NOT EXISTS near_duplicate_of uuid REFERENCES public.evidence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS near_duplicate_status text
    CHECK (near_duplicate_status IN ('unreviewed','confirmed','rejected'));

CREATE INDEX IF NOT EXISTS evidence_user_phash_idx
  ON public.evidence(user_id) WHERE perceptual_hash IS NOT NULL AND deleted_at IS NULL;
