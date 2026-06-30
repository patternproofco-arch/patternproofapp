
-- 1. Firms table (no cross-table policies yet)
CREATE TABLE public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.firms TO authenticated;
GRANT ALL ON public.firms TO service_role;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "create firms" ON public.firms FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER firms_updated_at BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Add firm_id to attorney_profiles
ALTER TABLE public.attorney_profiles
  ADD COLUMN firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL;
CREATE INDEX attorney_profiles_firm_id_idx ON public.attorney_profiles(firm_id);

-- 3. Now firm_id exists, add cross-table read policies
CREATE POLICY "read own firm" ON public.firms FOR SELECT TO authenticated
  USING (
    id IN (SELECT firm_id FROM public.attorney_profiles WHERE user_id = auth.uid() AND firm_id IS NOT NULL)
  );

CREATE POLICY "read firm colleagues" ON public.attorney_profiles FOR SELECT TO authenticated
  USING (
    firm_id IS NOT NULL
    AND firm_id IN (SELECT firm_id FROM public.attorney_profiles WHERE user_id = auth.uid() AND firm_id IS NOT NULL)
  );

-- 4. Case grants
CREATE TABLE public.case_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  attorney_user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_link_id, attorney_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_grants TO authenticated;
GRANT ALL ON public.case_grants TO service_role;
ALTER TABLE public.case_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "granter manages" ON public.case_grants FOR ALL TO authenticated
  USING (granted_by = auth.uid())
  WITH CHECK (granted_by = auth.uid());

CREATE POLICY "grantee reads own" ON public.case_grants FOR SELECT TO authenticated
  USING (attorney_user_id = auth.uid());

CREATE INDEX case_grants_attorney_idx ON public.case_grants(attorney_user_id) WHERE revoked_at IS NULL;
CREATE INDEX case_grants_link_idx ON public.case_grants(client_link_id);

CREATE TRIGGER case_grants_updated_at BEFORE UPDATE ON public.case_grants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
