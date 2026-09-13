CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  form_data jsonb NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE(org_id)
);

CREATE INDEX verification_requests_org_idx ON public.verification_requests (org_id);
CREATE INDEX verification_requests_status_idx ON public.verification_requests (status);

GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read and submit their own verification"
  ON public.verification_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = verification_requests.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert verification for their org"
  ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = verification_requests.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update their own verification"
  ON public.verification_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = verification_requests.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = verification_requests.org_id
        AND om.user_id = auth.uid()
    )
  );
