ALTER TABLE public.user_terms_acceptance DROP CONSTRAINT IF EXISTS user_terms_acceptance_pkey;

ALTER TABLE public.user_terms_acceptance
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS privacy_version text DEFAULT '2026-08-rev1',
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'survivor';

UPDATE public.user_terms_acceptance
SET privacy_version = COALESCE(privacy_version, 'legacy-unknown'),
    account_type = COALESCE(account_type, 'survivor')
WHERE privacy_version IS NULL OR account_type IS NULL;

ALTER TABLE public.user_terms_acceptance
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN privacy_version SET NOT NULL,
  ALTER COLUMN account_type SET NOT NULL,
  ADD CONSTRAINT user_terms_acceptance_pkey PRIMARY KEY (id),
  ADD CONSTRAINT user_terms_acceptance_account_type_check CHECK (account_type IN ('survivor', 'attorney', 'organization')),
  ADD CONSTRAINT user_terms_acceptance_version_unique UNIQUE (user_id, terms_version, privacy_version, account_type);

CREATE OR REPLACE FUNCTION public.normalize_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
  NEW.terms_version := '2026-08-rev2';
  NEW.privacy_version := '2026-08-rev1';
  NEW.terms_accepted_at := now();
  NEW.created_at := now();
  IF NEW.account_type NOT IN ('survivor', 'attorney', 'organization') THEN
    NEW.account_type := 'survivor';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_legal_acceptance_before_insert ON public.user_terms_acceptance;
CREATE TRIGGER normalize_legal_acceptance_before_insert
BEFORE INSERT ON public.user_terms_acceptance
FOR EACH ROW EXECUTE FUNCTION public.normalize_legal_acceptance();

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_terms_acceptance FROM authenticated;
GRANT SELECT, INSERT ON public.user_terms_acceptance TO authenticated;

COMMENT ON TABLE public.user_terms_acceptance IS 'Append-only, server-recorded acceptance of specific Terms and Privacy versions.';
