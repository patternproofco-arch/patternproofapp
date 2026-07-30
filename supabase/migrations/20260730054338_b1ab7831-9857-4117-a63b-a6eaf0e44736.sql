CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  interest text NOT NULL DEFAULT 'other',
  note text,
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_signups_email_key ON public.waitlist_signups (lower(email));

CREATE OR REPLACE FUNCTION public.waitlist_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'waitlist_signups.email must be a valid email address';
  END IF;
  IF NEW.interest NOT IN ('survivor','attorney','organization','other') THEN
    RAISE EXCEPTION 'waitlist_signups.interest must be survivor, attorney, organization or other';
  END IF;
  IF NEW.name IS NOT NULL AND length(NEW.name) > 120 THEN
    RAISE EXCEPTION 'waitlist_signups.name too long';
  END IF;
  IF NEW.note IS NOT NULL AND length(NEW.note) > 1000 THEN
    RAISE EXCEPTION 'waitlist_signups.note too long';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER waitlist_signups_validate
BEFORE INSERT OR UPDATE ON public.waitlist_signups
FOR EACH ROW EXECUTE FUNCTION public.waitlist_validate();

GRANT SELECT ON public.waitlist_signups TO authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read waitlist signups"
ON public.waitlist_signups FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));