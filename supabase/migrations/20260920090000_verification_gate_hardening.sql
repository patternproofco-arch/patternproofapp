-- Browser credentials cannot write review state, manufacture grants, or renew
-- engagement. The existing authenticated server functions handle these writes.
REVOKE INSERT, UPDATE, DELETE ON public.attorney_profiles,
  public.attorney_client_links, public.attorney_invitations,
  public.case_collaborators FROM anon, authenticated;

-- Existing permissive RLS policies remain subject to this additional gate.
-- SECURITY DEFINER is necessary to read reviewer-only verification tables.
CREATE OR REPLACE FUNCTION private.verified_attorney_link(p_link_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attorney_client_links l
    WHERE l.id = p_link_id AND l.status = 'active'
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND public.attorney_is_verified(l.attorney_user_id)
      AND public.attorney_is_verified(auth.uid())
      AND public.attorney_case_engagement_current(l.created_at, l.case_engagement_confirmed_at)
  );
$$;
REVOKE ALL ON FUNCTION private.verified_attorney_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.verified_attorney_link(uuid) TO authenticated, service_role;

CREATE POLICY verification_gate ON public.attorney_client_links
AS RESTRICTIVE FOR SELECT TO authenticated
USING (client_user_id = auth.uid() OR private.verified_attorney_link(id));

CREATE POLICY verification_gate ON public.case_collaborators
AS RESTRICTIVE FOR SELECT TO authenticated
USING (private.verified_attorney_link(link_id));

CREATE POLICY verification_gate ON public.attorney_messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.attorney_client_links l WHERE l.id = link_id AND l.client_user_id = auth.uid())
  OR private.verified_attorney_link(link_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.attorney_client_links l WHERE l.id = link_id AND l.client_user_id = auth.uid())
  OR private.verified_attorney_link(link_id)
);

CREATE OR REPLACE FUNCTION private.has_attorney_access(_attorney_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _attorney_id = auth.uid() AND public.attorney_is_verified(_attorney_id)
    AND EXISTS (SELECT 1 FROM public.attorney_client_links l
      WHERE l.attorney_user_id = _attorney_id AND l.client_user_id = _client_id
        AND l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now())
        AND public.attorney_case_engagement_current(l.created_at, l.case_engagement_confirmed_at));
$$;

-- Serialize grant creation with suspension using the same profile row lock.
-- This prevents a request checked before suspension from creating a live grant
-- after the suspension transaction has already revoked the old grants.
CREATE OR REPLACE FUNCTION public.enforce_verified_attorney_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM 1 FROM public.attorney_profiles WHERE user_id = NEW.attorney_user_id FOR UPDATE;
    IF NOT public.attorney_is_verified(NEW.attorney_user_id) THEN
      RAISE EXCEPTION 'Attorney is not verified';
    END IF;
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active' THEN
      IF NEW.invitation_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.attorney_invitations i
        WHERE i.id = NEW.invitation_id AND i.client_user_id = NEW.client_user_id
          AND i.survivor_confirmed_attorney_at IS NOT NULL
          AND i.survivor_confirmed_attorney_by = NEW.client_user_id
          AND i.status = 'pending'
          AND (i.expires_at IS NULL OR i.expires_at > now())
      ) THEN
        RAISE EXCEPTION 'Survivor confirmation required';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_verified_attorney_grant() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_verified_attorney_grant
BEFORE INSERT OR UPDATE OF status ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_attorney_grant();

CREATE OR REPLACE FUNCTION private.verified_advocate_org(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.org_members m WHERE m.user_id = p_user_id
      AND NOT public.org_is_verified(m.org_id)
  );
$$;
REVOKE ALL ON FUNCTION private.verified_advocate_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.verified_advocate_org(uuid) TO authenticated, service_role;

CREATE POLICY verification_gate ON public.advocate_client_links
AS RESTRICTIVE FOR SELECT TO authenticated
USING (client_user_id = auth.uid() OR
  (private.verified_advocate_org(auth.uid()) AND private.verified_advocate_org(advocate_user_id)));

CREATE OR REPLACE FUNCTION public.enforce_verified_advocate_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM 1 FROM public.dv_organizations o
      JOIN public.org_members m ON m.org_id = o.id
      WHERE m.user_id = NEW.advocate_user_id FOR UPDATE OF o;
    IF NOT private.verified_advocate_org(NEW.advocate_user_id) THEN
      RAISE EXCEPTION 'Organization is not verified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_verified_advocate_grant() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_verified_advocate_grant
BEFORE INSERT OR UPDATE OF status ON public.advocate_client_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_verified_advocate_grant();
