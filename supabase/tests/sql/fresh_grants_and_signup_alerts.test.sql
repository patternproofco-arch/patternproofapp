BEGIN;
DO $$
DECLARE
 survivor uuid := gen_random_uuid(); attorney uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
 item uuid := gen_random_uuid(); other_item uuid := gen_random_uuid(); old_id uuid := gen_random_uuid();
 invite uuid; stale uuid; fresh uuid; result_id uuid; second_id uuid; n integer; scope jsonb;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  (survivor,'survivor@example.invalid',now()),(attorney,'attorney@example.invalid',now()),(outsider,'outsider@example.invalid',now());
 INSERT INTO public.attorney_access_applications(user_id,email,full_name,bar_number,jurisdiction,status)
  VALUES(attorney,'attorney@example.invalid','Fictional Attorney','fictional','CA','approved');
 INSERT INTO public.incidents(id,user_id,description) VALUES(item,survivor,'fictional'),(other_item,outsider,'fictional');
 scope := jsonb_build_object('scope_incidents',jsonb_build_array(item),'scope_evidence','[]'::jsonb);
 INSERT INTO public.attorney_client_links(id,attorney_user_id,client_user_id,status,revoked_at,scope_incidents)
  VALUES(old_id,attorney,survivor,'revoked',now()-interval '1 day',ARRAY[item]);
 INSERT INTO public.attorney_invitations(client_user_id,attorney_email,created_at,expires_at,scope_incidents)
  VALUES(survivor,'attorney@example.invalid',now()-interval '2 days',now()+interval '1 day',ARRAY[item]) RETURNING id INTO stale;
 BEGIN
  PERFORM public.accept_attorney_share(stale,attorney,'attorney',scope);
  RAISE EXCEPTION 'Stale pre-revocation invitation was accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT status FROM public.attorney_invitations WHERE id=stale) <> 'pending' THEN RAISE EXCEPTION 'Rejected invitation was consumed'; END IF;
 INSERT INTO public.attorney_invitations(client_user_id,attorney_email,expires_at,scope_incidents)
  VALUES(survivor,'attorney@example.invalid',now()+interval '1 day',ARRAY[item]) RETURNING id INTO invite;
 BEGIN
  PERFORM public.accept_attorney_share(invite,outsider,'attorney',scope);
  RAISE EXCEPTION 'Wrong account accepted invitation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.accept_attorney_share(invite,attorney,'attorney',jsonb_build_object('scope_incidents',jsonb_build_array(other_item)));
  RAISE EXCEPTION 'Cross-account scope accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Recheck approval inside the transaction, after the server's preliminary gate.
 UPDATE public.attorney_access_applications SET status='rejected' WHERE user_id=attorney;
 BEGIN
  PERFORM public.accept_attorney_share(invite,attorney,'attorney',scope);
  RAISE EXCEPTION 'Rejected attorney accepted invitation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.attorney_access_applications SET status='approved' WHERE user_id=attorney;
 SELECT id INTO result_id FROM public.accept_attorney_share(invite,attorney,'attorney',scope);
 IF result_id=old_id OR result_id IS NULL THEN RAISE EXCEPTION 'Fresh consent did not create a new grant'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attorney_client_links WHERE id=old_id AND status='revoked' AND scope_incidents=ARRAY[item]) THEN
  RAISE EXCEPTION 'Old grant tombstone or scope changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE subject_id=result_id AND event_type='share_grant_created') THEN
  RAISE EXCEPTION 'New grant audit missing'; END IF;
 BEGIN
  PERFORM public.accept_attorney_share(invite,attorney,'attorney',scope);
  RAISE EXCEPTION 'Invitation replay accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.attorney_client_links(attorney_user_id,client_user_id) VALUES(attorney,survivor);
  RAISE EXCEPTION 'Multiple current grants allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 -- Current scope updates keep the identity; no reset of Clio consent on an
 -- ended grant can grant it to a new recipient relationship.
 INSERT INTO public.attorney_invitations(client_user_id,attorney_email,expires_at,scope_incidents)
  VALUES(survivor,'attorney@example.invalid',now()+interval '1 day',ARRAY[item]) RETURNING id INTO fresh;
 SELECT id INTO second_id FROM public.accept_attorney_share(fresh,attorney,'attorney',scope);
 IF second_id<>result_id THEN RAISE EXCEPTION 'Current share update created another identity'; END IF;
 -- Expired rows are preserved, with a new grant and no inherited permissions.
 UPDATE public.attorney_client_links SET expires_at=now()-interval '1 second',clio_share_consent=true WHERE id=result_id;
 INSERT INTO public.attorney_invitations(client_user_id,attorney_email,expires_at,scope_incidents)
  VALUES(survivor,'attorney@example.invalid',now()+interval '1 day',ARRAY[item]) RETURNING id INTO fresh;
 SELECT id INTO second_id FROM public.accept_attorney_share(fresh,attorney,'attorney',scope);
 IF second_id=result_id THEN RAISE EXCEPTION 'Expired row was reactivated'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attorney_client_links WHERE id=result_id AND status='revoked') THEN RAISE EXCEPTION 'Expired history lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.attorney_client_links WHERE id=second_id AND clio_share_consent) THEN RAISE EXCEPTION 'Clio consent inherited'; END IF;
 -- A survivor deliberately accepts a new request after ending the relationship.
 UPDATE public.attorney_client_links SET status='revoked',revoked_at=now() WHERE id=second_id;
 INSERT INTO public.attorney_survivor_invites(attorney_user_id,survivor_email) VALUES(attorney,'survivor@example.invalid') RETURNING id INTO fresh;
 SELECT id INTO second_id FROM public.accept_attorney_share(fresh,survivor,'survivor',scope);
 IF second_id IN (result_id,old_id) THEN RAISE EXCEPTION 'Survivor acceptance reused an ended grant'; END IF;
 BEGIN
  UPDATE public.attorney_client_links SET status='active',revoked_at=NULL WHERE id=old_id;
  RAISE EXCEPTION 'Old grant reactivated';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Notification failure/retry, concurrency lease, permanent deduplication.
 INSERT INTO public.user_roles(user_id,role) VALUES(survivor,'survivor');
 IF NOT EXISTS(SELECT 1 FROM public.signup_alert_outbox WHERE user_id=survivor AND role='survivor') THEN RAISE EXCEPTION 'Role did not queue alert'; END IF;
 IF NOT public.claim_signup_alert(survivor,'survivor',false) THEN RAISE EXCEPTION 'Initial alert claim failed'; END IF;
 IF public.claim_signup_alert(survivor,'survivor',false) THEN RAISE EXCEPTION 'Concurrent duplicate alert claimed'; END IF;
 UPDATE public.signup_alert_outbox SET next_attempt_at=now()-interval '1 second' WHERE user_id=survivor;
 IF NOT public.claim_signup_alert(survivor,'survivor',false) THEN RAISE EXCEPTION 'Failed alert could not retry'; END IF;
 UPDATE public.signup_alert_outbox SET completed_at=now(),outcome='sent',next_attempt_at=now()-interval '1 day' WHERE user_id=survivor;
 IF public.claim_signup_alert(survivor,'survivor',true) THEN RAISE EXCEPTION 'Delivered alert retried'; END IF;
 IF public.claim_signup_alert(outsider,'survivor',false) THEN RAISE EXCEPTION 'Historical account queued on login'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN
  PERFORM public.accept_attorney_share(invite,attorney,'attorney',scope);
  RAISE EXCEPTION 'Browser could invoke share acceptance RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.claim_signup_alert(survivor,'survivor',true);
  RAISE EXCEPTION 'Browser could claim founder alerts';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  SELECT count(*) INTO n FROM public.signup_alert_outbox;
  RAISE EXCEPTION 'Browser could read signup outbox';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';
 RAISE NOTICE 'PASS: fresh/expired/revoked grant identities, stale invitation and replay denial, scope ownership, approval recheck, unique current grant, Clio consent reset, durable signup retry/lease/deduplication, service-only RPCs';
END;
$$;
ROLLBACK;
