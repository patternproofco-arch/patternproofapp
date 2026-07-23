
-- Add link_id to attorney_missing_evidence_checklist so the checklist is
-- scoped to the case (all collaborators on the same link share one list),
-- not to the individual attorney user.
ALTER TABLE public.attorney_missing_evidence_checklist
  ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.attorney_client_links(id) ON DELETE CASCADE;

-- Backfill link_id from the owning attorney's active link to the client.
UPDATE public.attorney_missing_evidence_checklist AS m
SET link_id = l.id
FROM public.attorney_client_links l
WHERE m.link_id IS NULL
  AND l.attorney_user_id = m.attorney_user_id
  AND l.client_user_id   = m.client_user_id
  AND l.status = 'active';

-- Replace the old attorney-scoped unique index with a link-scoped one.
DROP INDEX IF EXISTS public.missing_evidence_ai_gap_unique;
CREATE UNIQUE INDEX missing_evidence_ai_gap_unique
  ON public.attorney_missing_evidence_checklist (link_id, item_label)
  WHERE source = 'ai_gap';

CREATE INDEX IF NOT EXISTS missing_evidence_link_idx
  ON public.attorney_missing_evidence_checklist (link_id);
