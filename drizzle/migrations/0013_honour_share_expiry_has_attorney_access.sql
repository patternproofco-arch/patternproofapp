CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attorney_client_links
    WHERE attorney_user_id = _attorney_id
      AND client_user_id = _client_id
      AND status = 'active'
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;
REVOKE ALL ON FUNCTION private.has_attorney_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_attorney_access(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Firm colleagues read firm client links" ON public.attorney_client_links;
CREATE POLICY "Firm colleagues read firm client links" ON public.attorney_client_links
  FOR SELECT TO authenticated
  USING (
    status = 'active' AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND private.my_firm_id() IS NOT NULL
    AND attorney_user_id IN (SELECT private.firm_peer_user_ids())
  );

DROP POLICY IF EXISTS "Org colleagues read org client links" ON public.advocate_client_links;
CREATE POLICY "Org colleagues read org client links" ON public.advocate_client_links
  FOR SELECT TO authenticated
  USING (
    status = 'active' AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND private.my_org_id() IS NOT NULL
    AND advocate_user_id IN (SELECT private.org_peer_user_ids())
  );