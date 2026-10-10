-- Synthetic records only. All users, records, grants and audit events roll back.
BEGIN;
CREATE TEMP TABLE launch_qa_users (label text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO launch_qa_users(label) VALUES ('owner'),('outsider'),('attorney'),('founder');
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT id, 'launch-qa-' || id || '@example.invalid', now() FROM launch_qa_users;
CREATE TEMP TABLE launch_qa_records (name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO launch_qa_records(name) VALUES ('incidents'),('evidence'),('cases'),('attorney_client_links'),('user_roles'),('support_requests'),('consent_grants');
GRANT SELECT ON launch_qa_users, launch_qa_records TO authenticated, anon;
INSERT INTO public.incidents(id,user_id,description) SELECT r.id,u.id,'Fictional launch QA incident' FROM launch_qa_records r,launch_qa_users u WHERE r.name='incidents' AND u.label='owner';
INSERT INTO public.evidence(id,user_id,title,file_url,file_type) SELECT r.id,u.id,'Fictional launch QA file','qa/not-uploaded','application/pdf' FROM launch_qa_records r,launch_qa_users u WHERE r.name='evidence' AND u.label='owner';
INSERT INTO public.cases(id,user_id) SELECT r.id,u.id FROM launch_qa_records r,launch_qa_users u WHERE r.name='cases' AND u.label='owner';
INSERT INTO public.user_roles(id,user_id,role) SELECT r.id,u.id,'survivor' FROM launch_qa_records r,launch_qa_users u WHERE r.name='user_roles' AND u.label='owner';
INSERT INTO public.support_requests(id,user_id,reply_email,category,message) SELECT r.id,u.id,'qa@example.invalid','Other','Fictional launch QA support ticket' FROM launch_qa_records r,launch_qa_users u WHERE r.name='support_requests' AND u.label='owner';
INSERT INTO public.attorney_client_links(id,client_user_id,attorney_user_id,expires_at) SELECT r.id,u.id,a.id,now()+interval '1 day' FROM launch_qa_records r,launch_qa_users u,launch_qa_users a WHERE r.name='attorney_client_links' AND u.label='owner' AND a.label='attorney';
INSERT INTO public.consent_grants(id,survivor_user_id,recipient_user_id) SELECT r.id,u.id,a.id FROM launch_qa_records r,launch_qa_users u,launch_qa_users a WHERE r.name='consent_grants' AND u.label='owner' AND a.label='attorney';
INSERT INTO public.attorney_applications(user_id,email,full_name,bar_number,jurisdiction) SELECT id,'launch-qa-'||id||'@example.invalid','Fictional QA attorney','QA-000','QA jurisdiction' FROM launch_qa_users WHERE label='attorney';
INSERT INTO public.user_roles(user_id,role) SELECT id,'admin' FROM launch_qa_users WHERE label='founder';

DO $$
DECLARE r record; n integer; a uuid; b uuid; c uuid; founder_id uuid; app uuid; protected_row uuid; stmt text;
BEGIN
 SELECT id INTO a FROM launch_qa_users WHERE label='owner';
 SELECT id INTO b FROM launch_qa_users WHERE label='outsider';
 SELECT id INTO c FROM launch_qa_users WHERE label='attorney';
 SELECT id INTO founder_id FROM launch_qa_users WHERE label='founder';
 SELECT id INTO protected_row FROM launch_qa_records WHERE name='attorney_client_links';
 SELECT id INTO app FROM public.attorney_applications WHERE user_id=c;
 PERFORM set_config('request.jwt.claim.sub', b::text, true);
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',b,'role','authenticated')::text, true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 FOR r IN SELECT * FROM launch_qa_records LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',r.name) INTO n USING r.id;
  IF n<>0 THEN RAISE EXCEPTION 'Cross-user SELECT leaked %',r.name; END IF;
  BEGIN
   EXECUTE format('UPDATE public.%I SET id=id WHERE id=$1',r.name) USING r.id;
   GET DIAGNOSTICS n = ROW_COUNT;
   IF n<>0 THEN RAISE EXCEPTION 'Cross-user UPDATE changed %',r.name; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
   EXECUTE format('DELETE FROM public.%I WHERE id=$1',r.name) USING r.id;
   GET DIAGNOSTICS n = ROW_COUNT;
   IF n<>0 THEN RAISE EXCEPTION 'Cross-user DELETE changed %',r.name; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 -- Spoofed ownership INSERTs are rejected, including owner-only role assignment.
 FOREACH stmt IN ARRAY ARRAY[
 'INSERT INTO public.incidents(user_id,description) VALUES ($1,''spoof'')',
 'INSERT INTO public.evidence(user_id,title,file_url,file_type) VALUES ($1,''spoof'',''qa/none'',''application/pdf'')',
 'INSERT INTO public.cases(user_id) VALUES ($1)',
 'INSERT INTO public.user_roles(user_id,role) VALUES ($1,''admin'')',
 'INSERT INTO public.support_requests(user_id,reply_email,category,message) VALUES ($1,''qa@example.invalid'',''Other'',''spoof'')',
 'INSERT INTO public.attorney_client_links(client_user_id,attorney_user_id) VALUES ($1,$1)',
 'INSERT INTO public.consent_grants(survivor_user_id,recipient_user_id) VALUES ($1,$1)'
 ] LOOP
  BEGIN EXECUTE stmt USING a; RAISE EXCEPTION 'Spoofed owner INSERT succeeded: %',stmt;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 BEGIN PERFORM public.set_my_clio_share_consent(protected_row,true); RAISE EXCEPTION 'Cross-user RPC succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';

 -- Positive control: the owner really can read all synthetic rows.
 PERFORM set_config('request.jwt.claim.sub', a::text, true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 FOR r IN SELECT * FROM launch_qa_records LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',r.name) INTO n USING r.id;
  IF n<>1 THEN RAISE EXCEPTION 'Owner SELECT failed for %',r.name; END IF;
 END LOOP;
 BEGIN UPDATE public.attorney_client_links SET expires_at=now()+interval '10 years' WHERE id=protected_row;
 RAISE EXCEPTION 'Owner could directly alter grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.set_my_clio_share_consent(protected_row,true);
 EXECUTE 'RESET ROLE';
 IF NOT EXISTS (SELECT 1 FROM public.audit_events WHERE subject_id=protected_row AND event_type='clio_consent_changed') THEN RAISE EXCEPTION 'Consent audit missing'; END IF;

 -- Pending attorneys cannot view the client link. Review RPC is server-only.
 PERFORM set_config('request.jwt.claim.sub', c::text, true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.attorney_client_links WHERE id=protected_row;
 IF n<>0 THEN RAISE EXCEPTION 'Pending attorney has client access'; END IF;
 BEGIN PERFORM public.review_attorney_application(app,founder_id,'approved');
 RAISE EXCEPTION 'Attorney self-approved'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub', '', true);
 PERFORM set_config('request.jwt.claims', '{}', true);
 PERFORM public.review_attorney_application(app,founder_id,'approved');
 PERFORM set_config('request.jwt.claim.sub', c::text, true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.attorney_client_links WHERE id=protected_row;
 IF n<>1 THEN RAISE EXCEPTION 'Approved attorney cannot read current link'; END IF;
 EXECUTE 'RESET ROLE';

 -- Expiry is enforced at RLS, even before a cleanup task runs.
 PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', '{}', true);
 UPDATE public.attorney_client_links SET expires_at=now()-interval '1 second' WHERE id=protected_row;
 PERFORM set_config('request.jwt.claim.sub', c::text, true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.attorney_client_links WHERE id=protected_row;
 IF n<>0 THEN RAISE EXCEPTION 'Expired link still visible'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', '{}', true);
 BEGIN UPDATE public.attorney_client_links SET expires_at=now()+interval '1 year' WHERE id=protected_row;
 RAISE EXCEPTION 'Server resurrected expired grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.attorney_client_links SET status='paused',expires_at=now()+interval '1 year' WHERE id=protected_row;
 RAISE EXCEPTION 'Expired grant bypassed via paused state'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.attorney_client_links SET status='revoked',revoked_at=now() WHERE id=protected_row;
 BEGIN UPDATE public.attorney_client_links SET status='active',revoked_at=NULL,expires_at=NULL WHERE id=protected_row;
 RAISE EXCEPTION 'Server resurrected revoked grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 PERFORM public.revoke_my_consent_grant((SELECT id FROM launch_qa_records WHERE name='consent_grants'));
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN UPDATE public.consent_grants SET status='active',revoked_at=NULL WHERE id=(SELECT id FROM launch_qa_records WHERE name='consent_grants');
 RAISE EXCEPTION 'Consent resurrected'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 -- Anonymous access and table privileges fail closed on every core table.
 EXECUTE 'SET LOCAL ROLE anon';
 FOR r IN SELECT * FROM launch_qa_records LOOP
  IF has_table_privilege('anon', 'public.'||r.name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Anonymous table privilege remains: %',r.name; END IF;
  BEGIN EXECUTE format('SELECT count(*) FROM public.%I',r.name) INTO n;
  RAISE EXCEPTION 'Anonymous SELECT permitted: %',r.name;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 EXECUTE 'RESET ROLE';
 RAISE NOTICE 'PASS: cross-user read/update/delete/insert isolation, owner positive controls, approval, expiry, permanent revocation, consent audit, anonymous privileges';
END;
$$;
ROLLBACK;
SELECT 'launch isolation checks passed; synthetic records rolled back' AS result;
