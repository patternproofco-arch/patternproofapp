ALTER TABLE public.attorney_missing_evidence_checklist
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
  CHECK (source IN ('ai_gap','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS missing_evidence_ai_gap_unique
  ON public.attorney_missing_evidence_checklist (attorney_user_id, client_user_id, item_label)
  WHERE source = 'ai_gap';