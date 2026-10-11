-- Preserve ended grants and their dependent records. Only one current grant
-- per attorney/survivor pair can exist; a new consent creates a new identity.
ALTER TABLE public.attorney_client_links
 DROP CONSTRAINT IF EXISTS attorney_client_links_attorney_user_id_client_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS attorney_client_links_current_pair
 ON public.attorney_client_links(attorney_user_id, client_user_id)
 WHERE status <> 'revoked' AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.accept_attorney_share(
 _invitation_id uuid, _actor_id uuid, _direction text, _scope jsonb
) RETURNS TABLE(id uuid, client_user_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 inv jsonb; attorney_id uuid; survivor_id uuid; actor_email text;
 current_link public.attorney_client_links; result_id uuid;
 incidents uuid[]; files uuid[]; ended_at timestamptz;
 patterns boolean; voices boolean; communications boolean; documents boolean;
 grant_case_id uuid; deadline timestamptz;
BEGIN
 IF _direction NOT IN ('attorney', 'survivor') THEN
  RAISE EXCEPTION 'Invalid invitation direction' USING ERRCODE='22023';
 END IF;
 IF _direction = 'attorney' THEN
  SELECT to_jsonb(i) INTO inv FROM public.attorney_invitations i
   WHERE i.id = _invitation_id FOR UPDATE;
  attorney_id := _actor_id; survivor_id := (inv->>'client_user_id')::uuid;
 ELSE
  SELECT to_jsonb(i) INTO inv FROM public.attorney_survivor_invites i
   WHERE i.id = _invitation_id FOR UPDATE;
  attorney_id := (inv->>'attorney_user_id')::uuid; survivor_id := _actor_id;
 END IF;
 IF inv IS NULL OR inv->>'status' <> 'pending' OR
  ((inv->>'expires_at')::timestamptz IS NOT NULL AND (inv->>'expires_at')::timestamptz <= now()) THEN
  RAISE EXCEPTION 'Invitation is invalid or expired' USING ERRCODE='42501';
 END IF;
 SELECT lower(u.email) INTO actor_email FROM auth.users u
  WHERE u.id = _actor_id AND u.email_confirmed_at IS NOT NULL;
 IF actor_email IS NULL OR actor_email <> lower(inv->>CASE WHEN _direction='attorney' THEN 'attorney_email' ELSE 'survivor_email' END) THEN
  RAISE EXCEPTION 'A matching confirmed account is required' USING ERRCODE='42501';
 END IF;
 IF NOT private.attorney_is_approved(attorney_id) THEN
  RAISE EXCEPTION 'Attorney approval required' USING ERRCODE='42501';
 END IF;
 -- Serialize two invitations for the same pair, including the first insert.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(attorney_id::text || ':' || survivor_id::text, 0));
 SELECT l.* INTO current_link FROM public.attorney_client_links l
  WHERE l.attorney_user_id=attorney_id AND l.client_user_id=survivor_id
   AND l.status <> 'revoked' AND l.revoked_at IS NULL FOR UPDATE;
 -- An invitation issued before withdrawal/expiry is no longer fresh consent.
 -- Survivor-side acceptance is a new, explicit choice made by the owner now.
 SELECT max(coalesce(l.revoked_at, l.expires_at)) INTO ended_at
  FROM public.attorney_client_links l WHERE l.attorney_user_id=attorney_id
   AND l.client_user_id=survivor_id AND
   (l.status='revoked' OR l.revoked_at IS NOT NULL OR l.expires_at <= now());
 IF _direction='attorney' AND ended_at IS NOT NULL AND
  (inv->>'created_at')::timestamptz <= ended_at THEN
  RAISE EXCEPTION 'Ask the survivor for a new invitation after the previous share ended' USING ERRCODE='42501';
 END IF;
 IF current_link.id IS NOT NULL AND current_link.status <> 'active' AND
  (current_link.expires_at IS NULL OR current_link.expires_at > now()) THEN
  RAISE EXCEPTION 'The current share is paused' USING ERRCODE='42501';
 END IF;
 incidents := ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(_scope->'scope_incidents','[]'::jsonb)));
 files := ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(_scope->'scope_evidence','[]'::jsonb)));
 IF EXISTS (SELECT 1 FROM unnest(incidents) x WHERE NOT EXISTS
  (SELECT 1 FROM public.incidents i WHERE i.id=x AND i.user_id=survivor_id AND i.deleted_at IS NULL)) OR
  EXISTS (SELECT 1 FROM unnest(files) x WHERE NOT EXISTS
  (SELECT 1 FROM public.evidence e WHERE e.id=x AND e.user_id=survivor_id AND e.deleted_at IS NULL)) THEN
  RAISE EXCEPTION 'The selected records are no longer available' USING ERRCODE='42501';
 END IF;
 IF _direction='attorney' THEN
  IF (NOT coalesce((inv->>'include_all_incidents')::boolean,false) AND NOT incidents <@
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(inv->'scope_incidents','[]'::jsonb)))) OR
   (NOT coalesce((inv->>'include_all_evidence')::boolean,false) AND NOT files <@
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(inv->'scope_evidence','[]'::jsonb)))) THEN
   RAISE EXCEPTION 'Scope exceeds the invitation' USING ERRCODE='42501';
  END IF;
  patterns := coalesce((inv->>'include_patterns')::boolean,false);
  voices := coalesce((inv->>'include_voice_notes')::boolean,false);
  communications := coalesce((inv->>'include_communications')::boolean,false);
  documents := coalesce((inv->>'include_legal_documents')::boolean,false);
  grant_case_id := (inv->>'case_id')::uuid;
 ELSE
  patterns := coalesce((_scope->>'include_patterns')::boolean,false);
  voices := false; communications := false; documents := false; grant_case_id := NULL;
 END IF;
 IF grant_case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id=grant_case_id AND c.user_id=survivor_id) THEN
  RAISE EXCEPTION 'Case does not belong to the survivor' USING ERRCODE='42501';
 END IF;
 deadline := (inv->>'expires_at')::timestamptz;
 IF current_link.id IS NOT NULL AND current_link.expires_at <= now() THEN
  UPDATE public.attorney_client_links SET status='revoked',revoked_at=expires_at WHERE attorney_client_links.id=current_link.id;
  current_link.id := NULL;
 END IF;
 IF current_link.id IS NULL THEN
  INSERT INTO public.attorney_client_links(attorney_user_id,client_user_id,invitation_id,
   scope_incidents,scope_evidence,include_all_incidents,include_all_evidence,
   include_patterns,include_voice_notes,include_communications,include_legal_documents,case_id,expires_at,status)
  VALUES(attorney_id,survivor_id,CASE WHEN _direction='attorney' THEN _invitation_id ELSE NULL END,
   incidents,files,false,false,patterns,voices,communications,documents,grant_case_id,deadline,'active')
  RETURNING attorney_client_links.id INTO result_id;
  PERFORM public.record_audit_event(survivor_id,'share_grant_created','attorney_client_links',result_id,
   _direction,_actor_id,jsonb_build_object('invitation_id',_invitation_id,'direction',_direction));
 ELSE
  UPDATE public.attorney_client_links SET invitation_id=CASE WHEN _direction='attorney' THEN _invitation_id ELSE NULL END,
   scope_incidents=incidents,scope_evidence=files,include_all_incidents=false,include_all_evidence=false,
   include_patterns=patterns,include_voice_notes=voices,include_communications=communications,
   include_legal_documents=documents,case_id=grant_case_id,expires_at=deadline
   WHERE attorney_client_links.id=current_link.id RETURNING attorney_client_links.id INTO result_id;
 END IF;
 IF _direction='attorney' THEN
  UPDATE public.attorney_invitations SET status='accepted',accepted_at=now(),accepted_by=_actor_id WHERE attorney_invitations.id=_invitation_id;
 ELSE
  UPDATE public.attorney_survivor_invites SET status='accepted',accepted_at=now(),accepted_by=_actor_id WHERE attorney_survivor_invites.id=_invitation_id;
 END IF;
 RETURN QUERY SELECT result_id,survivor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_attorney_share(uuid,uuid,text,jsonb) TO service_role;
