-- attorney_client_links has no updated_at column at all, yet
-- listMyAttorneyCaseNotes (survivor-attorney-notes.functions.ts) has always
-- selected one to show survivors when their attorney's note last changed.
-- That select has been failing at the database level on every call since it
-- was written — Postgrest rejects a select naming a nonexistent column —
-- so this survivor-facing feature has never actually returned data.
--
-- A generic updated_at would also bump on unrelated column changes on this
-- row (expires_at, include_voice_notes, etc.), which isn't what "when did
-- the note last change" should mean here — so this tracks the note
-- specifically.
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

-- Backfill existing non-empty notes so a currently-visible note doesn't show
-- as having no update time; created_at is the closest available signal.
UPDATE public.attorney_client_links
SET attorney_case_notes_updated_at = created_at
WHERE attorney_case_notes IS NOT NULL
  AND btrim(attorney_case_notes) <> ''
  AND attorney_case_notes_updated_at IS NULL;
