-- Add the columns already referenced by document extraction. No existing file
-- bytes, access grants, or verification state are changed. "ask" is not consent:
-- the server also requires explicit consent on each AI recognition request.
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS ai_permission text NOT NULL DEFAULT 'ask',
  ADD COLUMN IF NOT EXISTS is_sealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS extraction_pages integer,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_verified_by uuid;

-- No grants or policies are broadened. Unknown historical permission values
-- remain untouched and the application denies AI reading for them.
COMMENT ON COLUMN public.evidence.ai_permission IS
  'Document AI restriction: ask requires explicit consent per request; none, denied, null and unknown values deny recognition. Not a global AI control.';
COMMENT ON COLUMN public.evidence.is_sealed IS
  'Document extraction restriction. Not a representation of a court sealing order or a global access control.';
