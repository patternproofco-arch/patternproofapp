ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

ALTER TABLE public.attorney_invitations
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attorney_client_links_case_id
  ON public.attorney_client_links(case_id);
CREATE INDEX IF NOT EXISTS idx_attorney_invitations_case_id
  ON public.attorney_invitations(case_id);