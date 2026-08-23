-- Team-management controls layered on top of secure multi-seat membership.
-- All functions are service-role-only; role checks are repeated here so a
-- stale browser request cannot race a role or membership change.

CREATE OR REPLACE FUNCTION public.remove_firm_member(
  p_firm_id uuid,
  p_actor_id uuid,
  p_target_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_actor_role
  FROM public.firm_members
  WHERE firm_id = p_firm_id AND user_id = p_actor_id
  FOR UPDATE;
  SELECT role INTO v_target_role
  FROM public.firm_members
  WHERE firm_id = p_firm_id AND user_id = p_target_user_id
  FOR UPDATE;

  IF v_actor_role IS NULL OR v_target_role IS NULL THEN
    RAISE EXCEPTION 'Firm membership not found';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Firm owners cannot be removed without an ownership transfer';
  END IF;
  IF p_actor_id <> p_target_user_id
     AND NOT (v_actor_role = 'owner' OR (v_actor_role = 'admin' AND v_target_role = 'member')) THEN
    RAISE EXCEPTION 'Not authorized to remove this member';
  END IF;

  -- A firm grant is valid only while both sides remain members. Revoke both
  -- grants received by the departing member and grants originating from cases
  -- they own before deleting the membership row.
  UPDATE public.case_grants
  SET revoked_at = coalesce(revoked_at, now())
  WHERE revoked_at IS NULL
    AND (
      attorney_user_id = p_target_user_id
      OR client_link_id IN (
        SELECT id FROM public.attorney_client_links
        WHERE attorney_user_id = p_target_user_id
      )
    );

  DELETE FROM public.firm_members
  WHERE firm_id = p_firm_id AND user_id = p_target_user_id;
  UPDATE public.attorney_profiles
  SET firm_id = NULL, updated_at = now()
  WHERE user_id = p_target_user_id;
  INSERT INTO public.audit_events(
    user_id, event_type, subject_kind, subject_id, actor_kind, actor_id, meta
  ) VALUES (
    p_actor_id, 'team.firm_member_removed', 'firm', p_firm_id,
    'attorney', p_actor_id,
    jsonb_build_object('target_user_id', p_target_user_id)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_firm_member_role(
  p_firm_id uuid,
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_actor_role FROM public.firm_members
    WHERE firm_id = p_firm_id AND user_id = p_actor_id FOR UPDATE;
  SELECT role INTO v_target_role FROM public.firm_members
    WHERE firm_id = p_firm_id AND user_id = p_target_user_id FOR UPDATE;
  IF v_actor_role IS NULL OR v_target_role IS NULL THEN RAISE EXCEPTION 'Firm membership not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Use a dedicated ownership transfer'; END IF;
  IF v_actor_role <> 'owner' THEN RAISE EXCEPTION 'Only the owner can change team roles'; END IF;

  UPDATE public.firm_members SET role = p_role
  WHERE firm_id = p_firm_id AND user_id = p_target_user_id;
  INSERT INTO public.audit_events(user_id,event_type,subject_kind,subject_id,actor_kind,actor_id,meta)
  VALUES (p_actor_id,'team.firm_role_changed','firm',p_firm_id,'attorney',p_actor_id,
    jsonb_build_object('target_user_id',p_target_user_id,'role',p_role));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_org_member(
  p_org_id uuid,
  p_actor_id uuid,
  p_target_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.org_members
    WHERE org_id = p_org_id AND user_id = p_actor_id FOR UPDATE;
  SELECT role INTO v_target_role FROM public.org_members
    WHERE org_id = p_org_id AND user_id = p_target_user_id FOR UPDATE;
  IF v_actor_role IS NULL OR v_target_role IS NULL THEN RAISE EXCEPTION 'Organization membership not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Organization owners cannot be removed without an ownership transfer'; END IF;
  IF p_actor_id <> p_target_user_id
     AND NOT (v_actor_role = 'owner' OR (v_actor_role = 'admin' AND v_target_role = 'member')) THEN
    RAISE EXCEPTION 'Not authorized to remove this member';
  END IF;

  DELETE FROM public.org_members WHERE org_id = p_org_id AND user_id = p_target_user_id;
  UPDATE public.advocate_profiles SET org_id = NULL WHERE user_id = p_target_user_id;
  INSERT INTO public.audit_events(user_id,event_type,subject_kind,subject_id,actor_kind,actor_id,meta)
  VALUES (p_actor_id,'team.org_member_removed','organization',p_org_id,'advocate',p_actor_id,
    jsonb_build_object('target_user_id',p_target_user_id));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_org_member_role(
  p_org_id uuid,
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT role INTO v_actor_role FROM public.org_members
    WHERE org_id = p_org_id AND user_id = p_actor_id FOR UPDATE;
  SELECT role INTO v_target_role FROM public.org_members
    WHERE org_id = p_org_id AND user_id = p_target_user_id FOR UPDATE;
  IF v_actor_role IS NULL OR v_target_role IS NULL THEN RAISE EXCEPTION 'Organization membership not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Use a dedicated ownership transfer'; END IF;
  IF v_actor_role <> 'owner' THEN RAISE EXCEPTION 'Only the owner can change team roles'; END IF;

  UPDATE public.org_members SET role = p_role
  WHERE org_id = p_org_id AND user_id = p_target_user_id;
  INSERT INTO public.audit_events(user_id,event_type,subject_kind,subject_id,actor_kind,actor_id,meta)
  VALUES (p_actor_id,'team.org_role_changed','organization',p_org_id,'advocate',p_actor_id,
    jsonb_build_object('target_user_id',p_target_user_id,'role',p_role));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_firm_member(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_firm_member_role(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_org_member(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_org_member_role(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_firm_member(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_firm_member_role(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_org_member(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_org_member_role(uuid,uuid,uuid,text) TO service_role;
