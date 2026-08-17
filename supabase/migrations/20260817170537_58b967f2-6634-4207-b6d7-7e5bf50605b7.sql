-- Survivor portal foundations: record kinds, drafts, sealing, per-item AI permissions,
-- conversation-context labelling. Additive only; no existing column is altered or dropped.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS record_kind text NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS expected_item text,
  ADD COLUMN IF NOT EXISTS expected_due_date date,
  ADD COLUMN IF NOT EXISTS expected_due_range_start date,
  ADD COLUMN IF NOT EXISTS expected_due_range_end date,
  ADD COLUMN IF NOT EXISTS actual_outcome text,
  ADD COLUMN IF NOT EXISTS actual_outcome_date date,
  ADD COLUMN IF NOT EXISTS expectation_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS practical_consequence text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_permission text NOT NULL DEFAULT 'organize';

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS ai_permission text NOT NULL DEFAULT 'organize',
  ADD COLUMN IF NOT EXISTS conversation_context text NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_record_kind_chk') THEN
    ALTER TABLE public.incidents ADD CONSTRAINT incidents_record_kind_chk
      CHECK (record_kind IN ('event','expected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_expectation_status_chk') THEN
    ALTER TABLE public.incidents ADD CONSTRAINT incidents_expectation_status_chk
      CHECK (expectation_status IN ('open','fulfilled','partially_fulfilled','not_fulfilled','unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incidents_ai_permission_chk') THEN
    ALTER TABLE public.incidents ADD CONSTRAINT incidents_ai_permission_chk
      CHECK (ai_permission IN ('store_only','transcribe','organize','analyze_sequences','professional_summaries'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_ai_permission_chk') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_ai_permission_chk
      CHECK (ai_permission IN ('store_only','transcribe','organize','analyze_sequences','professional_summaries'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_conversation_context_chk') THEN
    ALTER TABLE public.evidence ADD CONSTRAINT evidence_conversation_context_chk
      CHECK (conversation_context IN ('complete','partial','unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS incidents_user_record_kind_idx
  ON public.incidents (user_id, record_kind);
CREATE INDEX IF NOT EXISTS incidents_user_draft_idx
  ON public.incidents (user_id, is_draft);
CREATE INDEX IF NOT EXISTS evidence_parent_idx
  ON public.evidence (parent_evidence_id) WHERE parent_evidence_id IS NOT NULL;