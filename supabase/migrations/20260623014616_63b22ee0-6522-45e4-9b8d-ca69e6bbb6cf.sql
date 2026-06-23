ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS attorney_case_notes text;