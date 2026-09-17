
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 1. Move RLS helper routines out of the exposed API schema
CREATE OR REPLACE FUNCTION private.my_firm_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT firm_id FROM public.firm_members WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION private.my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION private.firm_peer_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT fm.user_id FROM public.firm_members fm
      WHERE fm.firm_id = private.my_firm_id() AND private.my_firm_id() IS NOT NULL $$;

CREATE OR REPLACE FUNCTION private.org_peer_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT om.user_id FROM public.org_members om
      WHERE om.org_id = private.my_org_id() AND private.my_org_id() IS NOT NULL $$;

REVOKE ALL ON FUNCTION private.my_firm_id(), private.my_org_id(),
  private.firm_peer_user_ids(), private.org_peer_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.my_firm_id(), private.my_org_id(),
  private.firm_peer_user_ids(), private.org_peer_user_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS "Members read own organization" ON public.dv_organizations;
CREATE POLICY "Members read own organization" ON public.dv_organizations
  FOR SELECT TO authenticated USING (id = private.my_org_id());

DROP POLICY IF EXISTS "Members read own firm roster" ON public.firm_members;
CREATE POLICY "Members read own firm roster" ON public.firm_members
  FOR SELECT TO authenticated USING (firm_id = private.my_firm_id());

DROP POLICY IF EXISTS "Members read own org roster" ON public.org_members;
CREATE POLICY "Members read own org roster" ON public.org_members
  FOR SELECT TO authenticated USING (org_id = private.my_org_id());

DROP POLICY IF EXISTS "Firm members read their firm invitations" ON public.firm_member_invitations;
CREATE POLICY "Firm members read their firm invitations" ON public.firm_member_invitations
  FOR SELECT TO authenticated USING (firm_id = private.my_firm_id());

DROP POLICY IF EXISTS "Org members read their org invitations" ON public.org_member_invitations;
CREATE POLICY "Org members read their org invitations" ON public.org_member_invitations
  FOR SELECT TO authenticated USING (org_id = private.my_org_id());

DROP POLICY IF EXISTS "Firm colleagues read firm client links" ON public.attorney_client_links;
CREATE POLICY "Firm colleagues read firm client links" ON public.attorney_client_links
  FOR SELECT TO authenticated USING (
    status = 'active' AND revoked_at IS NULL AND private.my_firm_id() IS NOT NULL
    AND attorney_user_id IN (SELECT private.firm_peer_user_ids())
  );

DROP POLICY IF EXISTS "Org colleagues read org client links" ON public.advocate_client_links;
CREATE POLICY "Org colleagues read org client links" ON public.advocate_client_links
  FOR SELECT TO authenticated USING (
    status = 'active' AND revoked_at IS NULL AND private.my_org_id() IS NOT NULL
    AND advocate_user_id IN (SELECT private.org_peer_user_ids())
  );

DROP POLICY IF EXISTS "Firm colleagues read firm roster profiles" ON public.firms;
CREATE POLICY "Firm colleagues read firm roster profiles" ON public.firms
  FOR SELECT TO authenticated USING (id = private.my_firm_id());

DROP FUNCTION IF EXISTS public.firm_peer_user_ids();
DROP FUNCTION IF EXISTS public.org_peer_user_ids();
DROP FUNCTION IF EXISTS public.my_firm_id();
DROP FUNCTION IF EXISTS public.my_org_id();

-- 2. Connected-apps routines become server-only (called with an explicit user id)
CREATE OR REPLACE FUNCTION public.admin_list_oauth_consents(p_user_id uuid)
RETURNS TABLE(id uuid, client_id uuid, client_name text, client_uri text, scopes text, granted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
  select c.id, c.client_id, cl.client_name, cl.client_uri, c.scopes, c.granted_at
  from auth.oauth_consents c
  join auth.oauth_clients cl on cl.id = c.client_id
  where c.user_id = p_user_id and c.revoked_at is null and cl.deleted_at is null
  order by c.granted_at desc
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_oauth_consent(p_user_id uuid, _consent_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $$
declare _n int;
begin
  update auth.oauth_consents set revoked_at = now()
   where id = _consent_id and user_id = p_user_id and revoked_at is null;
  get diagnostics _n = row_count;
  return _n > 0;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_list_oauth_consents(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_revoke_oauth_consent(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_oauth_consents(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_oauth_consent(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.list_my_oauth_consents();
DROP FUNCTION IF EXISTS public.revoke_my_oauth_consent(uuid);
