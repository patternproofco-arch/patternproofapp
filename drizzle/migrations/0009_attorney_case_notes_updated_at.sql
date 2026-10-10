ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS attorney_case_notes_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.touch_attorney_case_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attorney_case_notes IS DISTINCT FROM OLD.attorney_case_notes THEN
    NEW.attorney_case_notes_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attorney_client_links_touch_case_notes ON public.attorney_client_links;
CREATE TRIGGER attorney_client_links_touch_case_notes
  BEFORE UPDATE ON public.attorney_client_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_attorney_case_notes_updated_at();

UPDATE public.attorney_client_links
SET attorney_case_notes_updated_at = created_at
WHERE attorney_case_notes IS NOT NULL
  AND btrim(attorney_case_notes) <> ''
  AND attorney_case_notes_updated_at IS NULL;