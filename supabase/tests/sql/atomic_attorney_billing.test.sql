BEGIN;
DO $$
DECLARE
 attorney uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 expired_owner uuid:=gen_random_uuid(); revoked_owner uuid:=gen_random_uuid();
 active_id uuid:=gen_random_uuid(); paused_id uuid:=gen_random_uuid(); expired_id uuid:=gen_random_uuid(); revoked_id uuid:=gen_random_uuid();
 firm_id uuid:=gen_random_uuid(); n integer; before_notes integer; before_audits integer; billing record;
BEGIN
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 (attorney,'billing-attorney@example.invalid',now()),(a,'billing-a@example.invalid',now()),
 (b,'billing-b@example.invalid',now()),(expired_owner,'billing-expired@example.invalid',now()),(revoked_owner,'billing-revoked@example.invalid',now());
 INSERT INTO public.user_roles(user_id,role) VALUES(attorney,'attorney');
 INSERT INTO public.attorney_profiles(user_id,full_name,email,trial_ends_at) VALUES(attorney,'Fictional Billing Attorney','billing-attorney@example.invalid',NULL);
 INSERT INTO public.attorney_access_applications(user_id,email,full_name,bar_number,jurisdiction,status)
 VALUES(attorney,'billing-attorney@example.invalid','Fictional Billing Attorney','QA-000','QA','approved');
 INSERT INTO public.firms(id,name,created_by) VALUES(firm_id,'Fictional billing firm',attorney);
 INSERT INTO public.attorney_client_links(id,attorney_user_id,client_user_id,status,expires_at,revoked_at) VALUES
 (active_id,attorney,a,'active',NULL,NULL),(paused_id,attorney,b,'paused',now()+interval '1 day',NULL),
 (expired_id,attorney,expired_owner,'active',now()-interval '1 day',NULL),
 (revoked_id,attorney,revoked_owner,'revoked',NULL,now()-interval '1 day');
 INSERT INTO public.subscriptions(user_id,stripe_subscription_id,stripe_customer_id,product_id,price_id,status,environment,current_period_end) VALUES
 (attorney,'qa_old_'||attorney,'qa_customer','qa_product','attorney_solo_monthly','canceled','live',now()-interval '1 day'),
 (attorney,'qa_other_'||attorney,'qa_customer','qa_product','attorney_firm_monthly','active','live',now()+interval '1 day'),
 (attorney,'qa_sandbox_'||attorney,'qa_customer','qa_product','attorney_firm_monthly','active','sandbox',now()+interval '1 day');
 EXECUTE 'SET LOCAL ROLE service_role';
 SELECT * INTO billing FROM public.attorney_billing_state(attorney,'live');
 IF NOT billing.entitled OR billing.firm_seats<>5 THEN RAISE EXCEPTION 'Another active subscription was ignored'; END IF;
 n:=public.sync_attorney_billing_access(attorney,'live');
 IF n<>1 OR (SELECT status FROM public.attorney_client_links WHERE id=paused_id)<>'active' THEN RAISE EXCEPTION 'Current paused grant not restored'; END IF;
 IF (SELECT seats_included FROM public.firms WHERE id=firm_id)<>5 THEN RAISE EXCEPTION 'Firm seats lost despite another active plan'; END IF;
 IF (SELECT status FROM public.attorney_client_links WHERE id=expired_id)<>'active' OR (SELECT status FROM public.attorney_client_links WHERE id=revoked_id)<>'revoked' THEN RAISE EXCEPTION 'Ended grants were modified'; END IF;
 SELECT count(*) INTO before_notes FROM public.notifications WHERE user_id IN(a,b,expired_owner,revoked_owner);
 IF before_notes<>1 OR public.sync_attorney_billing_access(attorney,'live')<>0 THEN RAISE EXCEPTION 'Duplicate delivery changed access'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE user_id IN(a,b,expired_owner,revoked_owner))<>before_notes THEN RAISE EXCEPTION 'Duplicate delivery duplicated a notice'; END IF;
 EXECUTE 'RESET ROLE';
 UPDATE public.subscriptions SET status='unpaid' WHERE user_id=attorney AND stripe_subscription_id='qa_other_'||attorney;
 EXECUTE 'SET LOCAL ROLE service_role';
 -- A sandbox plan cannot mask a failed live entitlement.
 n:=public.sync_attorney_billing_access(attorney,'sandbox');
 IF n<>2 OR (SELECT status FROM public.attorney_client_links WHERE id=active_id)<>'paused' OR (SELECT status FROM public.attorney_client_links WHERE id=paused_id)<>'paused' THEN RAISE EXCEPTION 'Lost live billing did not pause current grants'; END IF;
 IF (SELECT seats_included FROM public.firms WHERE id=firm_id)<>1 THEN RAISE EXCEPTION 'Firm seats did not shrink with entitlement'; END IF;
 EXECUTE 'RESET ROLE';
 UPDATE public.subscriptions SET status='active' WHERE user_id=attorney AND stripe_subscription_id='qa_other_'||attorney;
 -- Inject a failure for fictional survivor notices only. The RPC must roll
 -- back link writes, firm seats and audit events, permitting a clean retry.
 EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT launch_qa_billing_notice CHECK (user_id NOT IN (%L::uuid,%L::uuid) OR kind<>''attorney_access_resumed'') NOT VALID',a,b);
 SELECT count(*) INTO before_notes FROM public.notifications WHERE user_id IN(a,b);
 SELECT count(*) INTO before_audits FROM public.audit_events WHERE user_id IN(a,b);
 EXECUTE 'SET LOCAL ROLE service_role';
 BEGIN
  PERFORM public.sync_attorney_billing_access(attorney,'live');
  RAISE EXCEPTION 'Notification failure was swallowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 EXECUTE 'RESET ROLE';
 IF (SELECT status FROM public.attorney_client_links WHERE id=active_id)<>'paused' OR (SELECT seats_included FROM public.firms WHERE id=firm_id)<>1 THEN RAISE EXCEPTION 'Notification failure committed access or seats'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE user_id IN(a,b))<>before_notes OR (SELECT count(*) FROM public.audit_events WHERE user_id IN(a,b))<>before_audits THEN RAISE EXCEPTION 'Failed transaction left a notice or audit'; END IF;
 EXECUTE 'RESET ROLE';
 ALTER TABLE public.notifications DROP CONSTRAINT launch_qa_billing_notice;
 EXECUTE 'SET LOCAL ROLE service_role';
 IF public.sync_attorney_billing_access(attorney,'live')<>2 THEN RAISE EXCEPTION 'Failed notification could not retry cleanly'; END IF;
 EXECUTE 'RESET ROLE';
 UPDATE public.subscriptions SET status='canceled' WHERE user_id=attorney AND stripe_subscription_id='qa_other_'||attorney;
 -- Cancellation preserves the period already paid for.
 IF NOT (SELECT entitled FROM public.attorney_billing_state(attorney,'live')) THEN RAISE EXCEPTION 'Paid-through cancellation lost entitlement'; END IF;
 UPDATE public.subscriptions SET current_period_end=now()-interval '1 day' WHERE user_id=attorney AND stripe_subscription_id='qa_other_'||attorney;
 IF (SELECT entitled FROM public.attorney_billing_state(attorney,'live')) THEN RAISE EXCEPTION 'Expired paid period remained entitled'; END IF;
 UPDATE public.attorney_profiles SET trial_ends_at=now()+interval '1 day' WHERE user_id=attorney;
 IF NOT (SELECT entitled FROM public.attorney_billing_state(attorney,'live')) THEN RAISE EXCEPTION 'Founding trial was ignored'; END IF;
 UPDATE public.attorney_profiles SET trial_ends_at=now()-interval '1 day' WHERE user_id=attorney;
 UPDATE public.subscriptions SET status='active',current_period_end=now()+interval '1 day',price_id='court_ready_monthly' WHERE user_id=attorney AND stripe_subscription_id='qa_other_'||attorney;
 IF (SELECT entitled FROM public.attorney_billing_state(attorney,'live')) THEN RAISE EXCEPTION 'Survivor plan granted attorney entitlement'; END IF;
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN PERFORM public.sync_attorney_billing_access(attorney,'live'); RAISE EXCEPTION 'Browser invoked billing mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.attorney_billing_state(attorney,'live'); RAISE EXCEPTION 'Browser invoked private billing read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';
 RAISE NOTICE 'PASS: atomic billing/access/seats/notices, rollback and retry, duplicate events, multiple subscriptions, live precedence, paid-through periods, trials, revoked/expired grants and service-only RPCs';
END;
$$;
ROLLBACK;
SELECT 'atomic billing checks passed; synthetic records rolled back' AS result;
