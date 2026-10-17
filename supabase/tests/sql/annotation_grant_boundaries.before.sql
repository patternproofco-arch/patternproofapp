BEGIN;
CREATE TEMPORARY TABLE annotation_qa_ids(label text PRIMARY KEY,id uuid NOT NULL);
INSERT INTO annotation_qa_ids SELECT label,gen_random_uuid() FROM unnest(ARRAY['attorney','owner','outsider','old_grant','new_grant','case','file_a','file_b','file_c','entry_a','entry_b','old_review','new_review','hidden_review','current_note','hidden_note','old_checklist','new_checklist','calendar','message','clio']) AS label;
DO $$
DECLARE attorney uuid; owner uuid; old_grant uuid; new_grant uuid; case_id uuid; n integer;
BEGIN
 SELECT id INTO attorney FROM annotation_qa_ids WHERE label='attorney';
 SELECT id INTO owner FROM annotation_qa_ids WHERE label='owner';
 SELECT id INTO old_grant FROM annotation_qa_ids WHERE label='old_grant';
 SELECT id INTO new_grant FROM annotation_qa_ids WHERE label='new_grant';
 SELECT id INTO case_id FROM annotation_qa_ids WHERE label='case';
 INSERT INTO auth.users(id,email,email_confirmed_at) SELECT id,'annotation-qa-'||id||'@example.invalid',now() FROM annotation_qa_ids WHERE label IN('attorney','owner','outsider');
 INSERT INTO public.user_roles(user_id,role) VALUES(attorney,'attorney');
 INSERT INTO public.attorney_access_applications(user_id,email,full_name,bar_number,jurisdiction,status) VALUES(attorney,'annotation-qa-'||attorney||'@example.invalid','Fictional Annotation Attorney','QA-000','QA','approved');
 INSERT INTO public.incidents(id,user_id,description) SELECT id,owner,'Fictional annotation entry' FROM annotation_qa_ids WHERE label IN('entry_a','entry_b');
 INSERT INTO public.evidence(id,user_id,title,file_url,file_type) SELECT id,owner,'Fictional annotation file','qa/not-uploaded','application/pdf' FROM annotation_qa_ids WHERE label IN('file_a','file_b','file_c');
 INSERT INTO public.cases(id,user_id,other_party,highlighted_incident_ids,attached_evidence_ids)
 VALUES(case_id,owner,'Fictional other party',ARRAY(SELECT id FROM annotation_qa_ids WHERE label IN('entry_a','entry_b')),ARRAY(SELECT id FROM annotation_qa_ids WHERE label IN('file_a','file_b','file_c')));
 INSERT INTO public.attorney_client_links(id,attorney_user_id,client_user_id,status,created_at,revoked_at,scope_incidents,scope_evidence) VALUES(old_grant,attorney,owner,'revoked',now()-interval '4 days',now()-interval '1 day',ARRAY(SELECT id FROM annotation_qa_ids WHERE label='entry_a'),ARRAY(SELECT id FROM annotation_qa_ids WHERE label='file_a'));
 INSERT INTO public.attorney_client_links(id,attorney_user_id,client_user_id,status,case_id,scope_incidents,scope_evidence,clio_share_consent)
 VALUES(new_grant,attorney,owner,'active',case_id,ARRAY(SELECT id FROM annotation_qa_ids WHERE label='entry_a'),ARRAY(SELECT id FROM annotation_qa_ids WHERE label IN('file_a','file_b')),true);
 INSERT INTO public.attorney_evidence_reviews(id,attorney_user_id,client_user_id,evidence_id,notes,created_at)
 SELECT id,attorney,owner,(SELECT id FROM annotation_qa_ids WHERE label='file_a'),'Fictional earlier grant review',now()-interval '2 days' FROM annotation_qa_ids WHERE label='old_review';
 INSERT INTO public.attorney_missing_evidence_checklist(id,attorney_user_id,client_user_id,link_id,item_label) SELECT id,attorney,owner,old_grant,'Fictional earlier grant checklist' FROM annotation_qa_ids WHERE label='old_checklist';
 PERFORM set_config('request.jwt.claim.sub',attorney::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',attorney,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.attorney_evidence_reviews WHERE client_user_id=owner;
 EXECUTE 'RESET ROLE';
 IF to_regprocedure('private.current_annotation_grant(uuid,uuid,uuid)') IS NULL THEN
  IF n<>1 THEN RAISE EXCEPTION 'Legacy leak reproduction did not read the earlier review'; END IF;
  RAISE NOTICE 'REPRODUCED: a new grant exposes the earlier grant review through the legacy database policy';
 END IF;
 PERFORM set_config('request.jwt.claim.sub','',true); PERFORM set_config('request.jwt.claims','{}',true);
END;
$$;
