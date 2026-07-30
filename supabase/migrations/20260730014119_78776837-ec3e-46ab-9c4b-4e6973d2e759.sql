CREATE OR REPLACE FUNCTION public.evidence_validate_dating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date_precision NOT IN ('exact','approximate_month','range','before_anchor','after_anchor','unknown') THEN
    RAISE EXCEPTION 'evidence.date_precision must be one of exact, approximate_month, range, before_anchor, after_anchor, unknown';
  END IF;
  IF NEW.exif_choice NOT IN ('none','kept','stripped') THEN
    RAISE EXCEPTION 'evidence.exif_choice must be none, kept or stripped';
  END IF;
  RETURN NEW;
END;
$$;