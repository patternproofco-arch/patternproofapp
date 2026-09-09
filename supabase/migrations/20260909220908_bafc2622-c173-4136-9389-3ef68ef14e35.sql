ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS extraction_pages integer,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_verified_by uuid;

CREATE INDEX IF NOT EXISTS evidence_extraction_status_idx
  ON public.evidence (user_id, extraction_status);