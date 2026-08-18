-- ============ 1. DV organizations ============
CREATE TABLE public.dv_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dv_organizations TO authenticated;
GRANT ALL ON public.dv_organizations TO service_role;
ALTER TABLE public.dv_organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER dv_organizations_touch BEFORE UPDATE ON public.dv_organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 2. Membership tables ============
CREATE TABLE public.firm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_members_role_chk CHECK (role IN ('owner','member')),
  CONSTRAINT firm_members_one_firm_per_user UNIQUE (user_id),
  CONSTRAINT firm_members_unique UNIQUE (firm_id, user_id)
);
GRANT SELECT ON public.firm_members TO authenticated;
GRANT ALL ON public.firm_members TO service_role;
ALTER TABLE public.firm_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_members_role_chk CHECK (role IN ('owner','member')),
  CONSTRAINT org_members_one_org_per_user UNIQUE (user_id),
  CONSTRAINT org_members_unique UNIQUE (org_id, user_id)
);
GRANT SELECT ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- ============ 3. Seats on firms ============
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS seats_purchased integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS seats_included integer NOT NULL DEFAULT 3;
ALTER TABLE public.firms ADD CONSTRAINT firms_seat_bounds CHECK (seats_purchased BETWEEN 1 AND 10);

-- ============ 4. advocate_profiles.org_id ============
ALTER TABLE public.advocate_profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.dv_organizations(id) ON DELETE SET NULL;

-- ============ 5. Invitation tables ============
CREATE TABLE public.firm_member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  invite_token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_member_invitations_role_chk CHECK (role IN ('owner','member')),
  CONSTRAINT firm_member_invitations_status_chk CHECK (status IN ('pending','accepted','revoked'))
);
GRANT SELECT ON public.firm_member_invitations TO authenticated;
GRANT ALL ON public.firm_member_invitations TO service_role;
ALTER TABLE public.firm_member_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  invite_token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_member_invitations_role_chk CHECK (role IN ('owner','member')),
  CONSTRAINT org_member_invitations_status_chk CHECK (status IN ('pending','accepted','revoked'))
);
GRANT SELECT ON public.org_member_invitations TO authenticated;
GRANT ALL ON public.org_member_invitations TO service_role;
ALTER TABLE public.org_member_invitations ENABLE ROW LEVEL SECURITY;

-- ============ 6. Membership helper functions (security definer, no recursion) ============
CREATE OR REPLACE FUNCTION public.my_firm_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firm_id FROM public.firm_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_firm_owner(_firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_members
    WHERE user_id = auth.uid() AND firm_id = _firm_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid() AND org_id = _org_id AND role = 'owner'
  )
$$;

-- Peers: users in exactly the same workspace as the caller. NULL workspace -> empty set.
CREATE OR REPLACE FUNCTION public.firm_peer_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fm.user_id FROM public.firm_members fm
  WHERE fm.firm_id = public.my_firm_id() AND public.my_firm_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.org_peer_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.user_id FROM public.org_members om
  WHERE om.org_id = public.my_org_id() AND public.my_org_id() IS NOT NULL
$$;

-- ============ 7. Seat cap enforcement ============
CREATE OR REPLACE FUNCTION public.firm_members_seat_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  seats integer;
  used integer;
BEGIN
  SELECT seats_purchased INTO seats FROM public.firms WHERE id = NEW.firm_id;
  SELECT count(*) INTO used FROM public.firm_members WHERE firm_id = NEW.firm_id;
  IF used >= COALESCE(seats, 3) THEN
    RAISE EXCEPTION 'This firm workspace has no seats left (% of % used).', used, COALESCE(seats, 3)
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER firm_members_seat_guard BEFORE INSERT ON public.firm_members
  FOR EACH ROW EXECUTE FUNCTION public.firm_members_seat_guard();

-- ============ 8. RLS policies for the new tables ============
CREATE POLICY "Members read own organization" ON public.dv_organizations
  FOR SELECT TO authenticated USING (id = public.my_org_id());

CREATE POLICY "Members read own firm roster" ON public.firm_members
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id());

CREATE POLICY "Members read own org roster" ON public.org_members
  FOR SELECT TO authenticated USING (org_id = public.my_org_id());

CREATE POLICY "Firm members read their firm invitations" ON public.firm_member_invitations
  FOR SELECT TO authenticated USING (firm_id = public.my_firm_id());

CREATE POLICY "Org members read their org invitations" ON public.org_member_invitations
  FOR SELECT TO authenticated USING (org_id = public.my_org_id());

-- ============ 9. Workspace-wide read access to client links ============
CREATE POLICY "Firm colleagues read firm client links" ON public.attorney_client_links
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND revoked_at IS NULL
    AND public.my_firm_id() IS NOT NULL
    AND attorney_user_id IN (SELECT public.firm_peer_user_ids())
  );

CREATE POLICY "Org colleagues read org client links" ON public.advocate_client_links
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND revoked_at IS NULL
    AND public.my_org_id() IS NOT NULL
    AND advocate_user_id IN (SELECT public.org_peer_user_ids())
  );

CREATE POLICY "Firm colleagues read firm roster profiles" ON public.firms
  FOR SELECT TO authenticated USING (id = public.my_firm_id());

-- ============ 10. Backfill ============
-- Every attorney already attached to a firm becomes a member; firm creator is owner.
INSERT INTO public.firm_members (firm_id, user_id, role)
SELECT DISTINCT ON (ap.user_id)
  ap.firm_id,
  ap.user_id,
  CASE WHEN f.created_by = ap.user_id THEN 'owner' ELSE 'member' END
FROM public.attorney_profiles ap
JOIN public.firms f ON f.id = ap.firm_id
WHERE ap.firm_id IS NOT NULL
ORDER BY ap.user_id, ap.firm_id
ON CONFLICT (user_id) DO NOTHING;

-- Any firm left without an owner gets its earliest member promoted.
UPDATE public.firm_members fm
SET role = 'owner'
WHERE fm.id IN (
  SELECT DISTINCT ON (m.firm_id) m.id
  FROM public.firm_members m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.firm_members o WHERE o.firm_id = m.firm_id AND o.role = 'owner'
  )
  ORDER BY m.firm_id, m.joined_at
);

-- One dv_organizations row per distinct advocate org_name; advocates become owners.
INSERT INTO public.dv_organizations (name, created_by)
SELECT DISTINCT ON (btrim(ap.org_name)) btrim(ap.org_name), ap.user_id
FROM public.advocate_profiles ap
WHERE ap.org_name IS NOT NULL AND btrim(ap.org_name) <> ''
ORDER BY btrim(ap.org_name), ap.user_id;

UPDATE public.advocate_profiles ap
SET org_id = o.id
FROM public.dv_organizations o
WHERE ap.org_id IS NULL AND ap.org_name IS NOT NULL AND btrim(ap.org_name) = o.name;

INSERT INTO public.org_members (org_id, user_id, role)
SELECT ap.org_id, ap.user_id,
  CASE WHEN o.created_by = ap.user_id THEN 'owner' ELSE 'member' END
FROM public.advocate_profiles ap
JOIN public.dv_organizations o ON o.id = ap.org_id
WHERE ap.org_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;