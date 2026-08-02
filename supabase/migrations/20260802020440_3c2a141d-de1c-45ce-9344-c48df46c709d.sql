ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS clio_share_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clio_share_consent_at timestamptz;

CREATE TABLE public.clio_matter_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_client_link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  clio_matter_id text NOT NULL,
  clio_matter_display_number text,
  clio_matter_description text,
  linked_by uuid NOT NULL REFERENCES auth.users(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz
);

CREATE UNIQUE INDEX clio_matter_links_active_uniq
  ON public.clio_matter_links (attorney_client_link_id)
  WHERE unlinked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.clio_matter_links TO authenticated;
GRANT ALL ON public.clio_matter_links TO service_role;

ALTER TABLE public.clio_matter_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys read own clio matter links"
ON public.clio_matter_links FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attorney_client_links l
  WHERE l.id = clio_matter_links.attorney_client_link_id
    AND l.attorney_user_id = auth.uid()
    AND l.status = 'active' AND l.revoked_at IS NULL
));

CREATE POLICY "Attorneys link matters with consent"
ON public.clio_matter_links FOR INSERT TO authenticated
WITH CHECK (
  linked_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = clio_matter_links.attorney_client_link_id
      AND l.attorney_user_id = auth.uid()
      AND l.status = 'active' AND l.revoked_at IS NULL
      AND l.clio_share_consent = true
  )
);

CREATE POLICY "Attorneys update own clio matter links"
ON public.clio_matter_links FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attorney_client_links l
  WHERE l.id = clio_matter_links.attorney_client_link_id
    AND l.attorney_user_id = auth.uid()
    AND l.status = 'active' AND l.revoked_at IS NULL
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.attorney_client_links l
  WHERE l.id = clio_matter_links.attorney_client_link_id
    AND l.attorney_user_id = auth.uid()
    AND l.status = 'active' AND l.revoked_at IS NULL
));

CREATE POLICY "Clients manage clio share consent"
ON public.attorney_client_links FOR UPDATE TO authenticated
USING (auth.uid() = client_user_id)
WITH CHECK (auth.uid() = client_user_id);

CREATE OR REPLACE FUNCTION public.attorney_client_links_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.client_user_id THEN
    RETURN NEW;
  END IF;

  -- Survivors may only flip the Clio consent fields, or revoke the link
  -- (handled by the existing revoke policy).
  IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RETURN NEW;
  END IF;

  IF ROW(NEW.id, NEW.attorney_user_id, NEW.client_user_id, NEW.invitation_id,
         NEW.scope_incidents, NEW.scope_evidence, NEW.include_all_incidents,
         NEW.include_all_evidence, NEW.include_patterns, NEW.status,
         NEW.revoked_at, NEW.created_at, NEW.attorney_case_notes, NEW.org_id,
         NEW.deposition_prep_consent, NEW.deposition_prep_consent_at, NEW.case_id)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.attorney_user_id, OLD.client_user_id, OLD.invitation_id,
         OLD.scope_incidents, OLD.scope_evidence, OLD.include_all_incidents,
         OLD.include_all_evidence, OLD.include_patterns, OLD.status,
         OLD.revoked_at, OLD.created_at, OLD.attorney_case_notes, OLD.org_id,
         OLD.deposition_prep_consent, OLD.deposition_prep_consent_at, OLD.case_id)
  THEN
    RAISE EXCEPTION 'Only the Clio sharing consent fields can be changed here'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER attorney_client_links_client_update_guard
BEFORE UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.attorney_client_links_client_update_guard();