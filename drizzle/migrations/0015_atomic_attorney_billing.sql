-- One entitlement decision across all subscriptions, preserving paid-through
-- periods and founding trials. Live billing takes precedence over sandbox data.
CREATE OR REPLACE FUNCTION public.attorney_billing_state(_attorney_id uuid, _environment text DEFAULT NULL)
RETURNS TABLE(entitled boolean, firm_seats integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH chosen AS (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id=_attorney_id AND environment='live')
   THEN 'live' ELSE coalesce(_environment,'sandbox') END AS environment
 ), eligible AS (
  SELECT s.price_id FROM public.subscriptions s,chosen c
  WHERE s.user_id=_attorney_id AND s.environment=c.environment
   AND s.price_id IN ('attorney_solo_monthly','attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly','attorney_portal_monthly_297')
   AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
    OR (s.status='canceled' AND s.current_period_end > now()))
 )
 SELECT EXISTS (SELECT 1 FROM eligible) OR EXISTS (
  SELECT 1 FROM public.attorney_profiles WHERE user_id=_attorney_id AND trial_ends_at > now()),
  CASE WHEN EXISTS (SELECT 1 FROM eligible WHERE price_id IN ('attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly')) THEN 5 ELSE 1 END;
$$;
REVOKE ALL ON FUNCTION public.attorney_billing_state(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attorney_billing_state(uuid,text) TO service_role;

-- Mutation, audit triggers, firm seats and survivor notices commit together.
-- A failed notification rolls back the access write so the provider can retry.
CREATE OR REPLACE FUNCTION public.sync_attorney_billing_access(_attorney_id uuid,_environment text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE billing record; target_status text; affected integer;
BEGIN
 IF _environment NOT IN ('live','sandbox') OR _environment IS NULL THEN
  RAISE EXCEPTION 'Invalid billing environment' USING ERRCODE='22023';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('billing:'||_attorney_id::text,0));
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_attorney_id AND role='attorney') THEN RETURN 0; END IF;
 SELECT * INTO billing FROM public.attorney_billing_state(_attorney_id,_environment);
 target_status := CASE WHEN billing.entitled THEN 'active' ELSE 'paused' END;
 UPDATE public.firms SET seats_included=billing.firm_seats,updated_at=now() WHERE created_by=_attorney_id;
 WITH changed AS (
  UPDATE public.attorney_client_links SET status=target_status
  WHERE attorney_user_id=_attorney_id AND status IN ('active','paused') AND status<>target_status
   AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  RETURNING id,client_user_id
 )
 INSERT INTO public.notifications(user_id,kind,title,body,metadata)
 SELECT client_user_id,
  CASE WHEN target_status='active' THEN 'attorney_access_resumed' ELSE 'attorney_access_paused' END,
  CASE WHEN target_status='active' THEN 'Your attorney''s access is back on' ELSE 'Your attorney''s access is paused' END,
  CASE WHEN target_status='active' THEN 'Your attorney''s subscription or trial is active again, so their shared view of what you chose to share is back on. You can end their access at any time.'
   ELSE 'Your records are safe and unchanged. Your attorney''s shared view is paused until their subscription or trial is active again.' END,
  jsonb_build_object('link_id',id,'attorney_user_id',_attorney_id)
 FROM changed;
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_attorney_billing_access(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_attorney_billing_access(uuid,text) TO service_role;
