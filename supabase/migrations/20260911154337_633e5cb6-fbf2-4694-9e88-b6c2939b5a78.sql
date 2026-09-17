CREATE TABLE public.matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL,
  firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL,
  client_link_id uuid REFERENCES public.attorney_client_links(id) ON DELETE SET NULL,
  matter_name text NOT NULL,
  matter_number text,
  case_type text,
  court text,
  jurisdiction text,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matter_advocate_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  attorney_user_id uuid NOT NULL,
  advocate_email text NOT NULL,
  advocate_name text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matter_advocates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  advocate_user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  advocate_email text,
  advocate_name text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matter_id, advocate_user_id)
);

CREATE INDEX matters_attorney_idx ON public.matters (attorney_user_id, created_at DESC);
CREATE INDEX matter_adv_inv_matter_idx ON public.matter_advocate_invitations (matter_id);
CREATE INDEX matter_advocates_advocate_idx ON public.matter_advocates (advocate_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matters TO authenticated;
GRANT ALL ON public.matters TO service_role;
GRANT SELECT ON public.matter_advocate_invitations TO authenticated;
GRANT ALL ON public.matter_advocate_invitations TO service_role;
GRANT SELECT ON public.matter_advocates TO authenticated;
GRANT ALL ON public.matter_advocates TO service_role;

ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_advocate_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matter_advocates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage their own matters"
  ON public.matters FOR ALL TO authenticated
  USING (auth.uid() = attorney_user_id)
  WITH CHECK (auth.uid() = attorney_user_id);

CREATE POLICY "Assigned advocates can read their matters"
  ON public.matters FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matter_advocates ma
    WHERE ma.matter_id = matters.id
      AND ma.advocate_user_id = auth.uid()
      AND ma.revoked_at IS NULL
  ));

CREATE POLICY "Attorneys read their own advocate invitations"
  ON public.matter_advocate_invitations FOR SELECT TO authenticated
  USING (auth.uid() = attorney_user_id);

CREATE POLICY "Attorneys read assignments they granted"
  ON public.matter_advocates FOR SELECT TO authenticated
  USING (auth.uid() = granted_by);

CREATE POLICY "Advocates read their own assignments"
  ON public.matter_advocates FOR SELECT TO authenticated
  USING (auth.uid() = advocate_user_id);

CREATE TRIGGER matters_touch_updated_at
  BEFORE UPDATE ON public.matters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();