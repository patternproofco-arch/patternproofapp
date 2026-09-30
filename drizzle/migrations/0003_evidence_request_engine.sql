ALTER TABLE public.attorney_document_requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'document',
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_note text,
  ADD COLUMN IF NOT EXISTS response_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS draft_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz;
COMMENT ON COLUMN public.attorney_document_requests.response_note IS 'Survivor draft/answer. Only exposed to the professional after submitted_at is set.';