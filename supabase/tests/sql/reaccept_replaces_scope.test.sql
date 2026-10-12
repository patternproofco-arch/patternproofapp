-- Re-accepting replaces scope entirely; a revoked grant is never re-armed.
BEGIN;
DO $$
DECLARE
 survivor uuid := gen_random_uuid(); attorney uuid := gen_random_uuid();
 old_ids uuid[] := ARRAY[]::uuid[]; pick uuid[]; i integer; old_link uuid := gen_random_uuid();
 invite uuid; new_link uuid; again uuid; r record;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  (survivor,'reaccept-survivor@example.invalid',now()),(attorney,'reaccept-attorney@example.invalid',now());
 INSERT INTO public.attorney_access_applications(user_id,email,full_name,bar_number,jurisdiction,status)
  VALUES(attorney,'reaccept-attorney@example.invalid','Fictional Attorney','fictional','CA','approved');
 FOR i IN 1..12 LOOP old_ids := old_ids || gen_random_uuid(); END LOOP;
 INSERT INTO public.incidents(id,user_id,description) SELECT x,survivor,'fictional' FROM unnest(old_ids) x;
 pick := ARRAY[old_ids[11], old_ids[12]];
 -- A revoked grant that had 10 ids and broad include_* flags.
 INSERT INTO public.attorney_client_links(id,attorney_user_id,client_user_id,status,revoked_at,expires_at,
   scope_incidents,include_patterns,include_voice_notes,include_communications,include_legal_documents)
  VALUES(old_link,attorney,survivor,'revoked',now()-interval '1 day',now()-interval '12 hours',
   old_ids[1:10],true,true,true,true);
 INSERT INTO public.attorney_survivor_invites(attorney_user_id,survivor_email,expires_at)
  VALUES(attorney,'reaccept-survivor@example.invalid',now()+interval '30 days') RETURNING id INTO invite;
 SELECT id INTO new_link FROM public.accept_attorney_share(invite,survivor,'survivor',
  jsonb_build_object('scope_incidents',to_jsonb(pick),'scope_evidence','[]'::jsonb,'include_patterns',false));
 IF new_link = old_link THEN RAISE EXCEPTION 'Revoked grant was re-armed in place'; END IF;
 SELECT * INTO r FROM public.attorney_client_links WHERE id=new_link;
 IF r.scope_incidents IS DISTINCT FROM pick THEN RAISE EXCEPTION 'New grant scope is not exactly the new pick: %', r.scope_incidents; END IF;
 IF r.revoked_at IS NOT NULL OR r.status <> 'active' THEN RAISE EXCEPTION 'New grant not live'; END IF;
 IF r.expires_at IS NULL OR r.expires_at <= now() THEN RAISE EXCEPTION 'New grant expiry not fresh'; END IF;
 IF r.include_patterns OR r.include_voice_notes OR r.include_communications OR r.include_legal_documents
  OR r.include_all_incidents OR r.include_all_evidence THEN RAISE EXCEPTION 'Old include_* flags inherited'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attorney_client_links WHERE id=old_link AND status='revoked'
  AND revoked_at IS NOT NULL AND scope_incidents=old_ids[1:10]) THEN RAISE EXCEPTION 'Tombstone changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE subject_id=new_link AND event_type='share_grant_created')
  THEN RAISE EXCEPTION 'Create audit missing'; END IF;

 -- Now the CURRENT grant holds 10 ids + flags; a new survivor accept with 2 ids replaces it.
 UPDATE public.attorney_client_links SET scope_incidents=old_ids[1:10],include_patterns=true WHERE id=new_link;
 INSERT INTO public.attorney_survivor_invites(attorney_user_id,survivor_email,expires_at)
  VALUES(attorney,'reaccept-survivor@example.invalid',now()+interval '60 days') RETURNING id INTO invite;
 SELECT id INTO again FROM public.accept_attorney_share(invite,survivor,'survivor',
  jsonb_build_object('scope_incidents',to_jsonb(pick),'scope_evidence','[]'::jsonb,'include_patterns',false));
 IF again <> new_link THEN RAISE EXCEPTION 'Current grant identity changed'; END IF;
 SELECT * INTO r FROM public.attorney_client_links WHERE id=again;
 IF r.scope_incidents IS DISTINCT FROM pick THEN RAISE EXCEPTION 'Scope merged instead of replaced: %', r.scope_incidents; END IF;
 IF r.include_patterns THEN RAISE EXCEPTION 'include_patterns not replaced'; END IF;
 IF r.expires_at < now()+interval '59 days' THEN RAISE EXCEPTION 'expires_at not reset to the new invite'; END IF;
 IF r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'revoked_at set'; END IF;

 -- Clearing revoked_at on a tombstone is refused by the database itself.
 BEGIN
  UPDATE public.attorney_client_links SET status='active',revoked_at=NULL,expires_at=now()+interval '1 day' WHERE id=old_link;
  RAISE EXCEPTION 'Tombstone was re-armed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS: re-accept replaces scope and include_* (no merge), revoked grants never re-armed, fresh expiry, create audit';
END;
$$;
ROLLBACK;
