-- listMyAttorneyCaseNotes (src/lib/survivor-attorney-notes.functions.ts) selects
-- attorney_client_links.updated_at to show a survivor when their attorney last
-- edited case notes, but this column was never added to the table. Every call
-- has been failing with a PostgREST "column does not exist" error, so the
-- survivor-facing attorney-notes panel on /settings has been broken since it
-- shipped. Add the column and keep it current the same way every other
-- touch_updated_at table in this schema does.

ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.attorney_client_links SET updated_at = created_at;

CREATE TRIGGER attorney_client_links_touch_updated_at
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
