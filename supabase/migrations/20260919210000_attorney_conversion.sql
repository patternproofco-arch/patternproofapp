-- Reviewed rollout only. Applying this migration does NOT enable an offer or send email.
BEGIN;
CREATE TABLE public.attorney_conversion_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  nurture_enabled boolean NOT NULL DEFAULT false,
  payment_environment text NOT NULL DEFAULT 'live' CHECK (payment_environment IN ('live','sandbox'))
);
INSERT INTO public.attorney_conversion_settings(id) VALUES (1);

CREATE TABLE public.attorney_conversion_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  discount_approved_at timestamptz,
  -- Deliberately not FK to matters/links/cases: deletion must not reset a used free case.
  free_matter_id uuid UNIQUE,
  free_link_id uuid,
  free_case_id uuid,
  CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  CHECK ((free_link_id IS NULL) = (free_case_id IS NULL))
);
ALTER TABLE public.attorney_conversion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attorney_conversion_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_conversion_settings, public.attorney_conversion_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attorney_conversion_settings, public.attorney_conversion_accounts TO service_role;

-- Lock a shared billing owner so simultaneous inserts/reopens cannot exceed the cap.
CREATE FUNCTION public.enforce_attorney_conversion_matter_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.attorney_conversion_settings;
  acct public.attorney_conversion_accounts;
  payer uuid;
  actual_firm uuid;
  plan text;
  cap integer;
  used integer;
  link_case uuid;
BEGIN
  SELECT * INTO cfg FROM public.attorney_conversion_settings WHERE id = 1;
  IF NOT cfg.enabled THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.attorney_user_id AND role = 'attorney') THEN
    RAISE EXCEPTION 'Attorney role required';
  END IF;
  -- Permit FK cleanup on firm deletion without turning it into a new purchase.
  IF TG_OP = 'UPDATE' AND OLD.firm_id IS NOT NULL AND NEW.firm_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.firms WHERE id = OLD.firm_id) THEN RETURN NEW; END IF;
  -- Closing a matter never costs a new slot. Identity cannot move between accounts.
  IF TG_OP = 'UPDATE' AND (NEW.attorney_user_id IS DISTINCT FROM OLD.attorney_user_id OR NEW.firm_id IS DISTINCT FROM OLD.firm_id) THEN
    RAISE EXCEPTION 'Matter ownership cannot be changed';
  END IF;
  SELECT fm.firm_id INTO actual_firm FROM public.firm_members fm WHERE fm.user_id = NEW.attorney_user_id LIMIT 1;
  IF NEW.firm_id IS DISTINCT FROM actual_firm THEN RAISE EXCEPTION 'Verified firm membership required'; END IF;
  payer := NEW.attorney_user_id;
  IF actual_firm IS NOT NULL THEN
    SELECT created_by INTO payer FROM public.firms WHERE id = actual_firm;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(payer::text, 772));
  SELECT price_id INTO plan FROM public.subscriptions
    WHERE user_id = payer AND environment = cfg.payment_environment
      AND status IN ('active','trialing','past_due','canceled')
      AND (current_period_end > now() OR (current_period_end IS NULL AND status <> 'canceled'))
    ORDER BY created_at DESC LIMIT 1;
  cap := CASE plan
    WHEN 'attorney_solo_v2_monthly' THEN 5
    WHEN 'attorney_legal_aid_v2_monthly' THEN 5
    WHEN 'attorney_practice_v2_monthly' THEN 25
    WHEN 'attorney_firm_v2_monthly' THEN 50
    ELSE NULL END;
  -- Existing contracts and trials keep their terms; this is not a forced price migration.
  IF cap IS NULL AND plan IN ('attorney_solo_monthly','attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly','attorney_portal_monthly_297') THEN RETURN NEW; END IF;
  IF cap IS NULL AND EXISTS (SELECT 1 FROM public.attorney_profiles WHERE user_id = NEW.attorney_user_id AND trial_ends_at > now()) THEN RETURN NEW; END IF;
  IF cap IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.attorney_conversion_accounts WHERE user_id = NEW.attorney_user_id AND approved_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Attorney access review is required';
    END IF;
    IF NEW.status = 'closed' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'open' THEN RETURN NEW; END IF;
    SELECT count(*) INTO used FROM public.matters
      WHERE status = 'open' AND id <> NEW.id
        AND (CASE WHEN actual_firm IS NULL THEN attorney_user_id = payer ELSE firm_id = actual_firm END);
    IF used >= cap THEN RAISE EXCEPTION 'Your plan has reached its active case limit. Close a case or choose another plan.'; END IF;
    RETURN NEW;
  END IF;
  IF actual_firm IS NOT NULL THEN RAISE EXCEPTION 'An active firm plan is required'; END IF;
  SELECT * INTO acct FROM public.attorney_conversion_accounts WHERE user_id = NEW.attorney_user_id FOR UPDATE;
  IF acct.approved_at IS NULL THEN RAISE EXCEPTION 'Attorney access review is required before opening a free case'; END IF;
  IF acct.free_matter_id IS NOT NULL AND acct.free_matter_id <> NEW.id THEN
    RAISE EXCEPTION 'Your first case is free. To manage additional cases, choose a plan.';
  END IF;
  IF NEW.client_link_id IS NOT NULL THEN
    SELECT case_id INTO link_case FROM public.attorney_client_links
      WHERE id = NEW.client_link_id AND attorney_user_id = NEW.attorney_user_id
        AND status = 'active' AND (expires_at IS NULL OR expires_at > now());
    IF link_case IS NULL THEN RAISE EXCEPTION 'The free case requires an active share scoped to one case'; END IF;
    IF acct.free_link_id IS NOT NULL AND (acct.free_link_id <> NEW.client_link_id OR acct.free_case_id <> link_case) THEN
      RAISE EXCEPTION 'The free case cannot be exchanged for another shared file';
    END IF;
  END IF;
  UPDATE public.attorney_conversion_accounts SET free_matter_id = NEW.id,
    free_link_id = coalesce(free_link_id, NEW.client_link_id),
    free_case_id = coalesce(free_case_id, link_case)
    WHERE user_id = NEW.attorney_user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_attorney_conversion_matter_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER attorney_conversion_matter_limit BEFORE INSERT OR UPDATE ON public.matters
FOR EACH ROW EXECUTE FUNCTION public.enforce_attorney_conversion_matter_limit();

-- Invitation acceptance is also capped; creating more shares cannot bypass matter limits.
CREATE FUNCTION public.enforce_attorney_conversion_share_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.attorney_conversion_settings;
  acct public.attorney_conversion_accounts;
  payer uuid; actual_firm uuid; plan text; cap integer; used integer;
BEGIN
  SELECT * INTO cfg FROM public.attorney_conversion_settings WHERE id = 1;
  IF NOT cfg.enabled OR NEW.status <> 'active' THEN RETURN NEW; END IF;
  -- A deleted case must never widen a scoped grant into a legacy all-cases grant.
  IF TG_OP = 'UPDATE' AND OLD.case_id IS NOT NULL AND NEW.case_id IS NULL THEN
    NEW.status := 'revoked'; RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.attorney_user_id IS DISTINCT FROM OLD.attorney_user_id THEN
    RAISE EXCEPTION 'Shared file ownership cannot be changed';
  END IF;
  SELECT firm_id INTO actual_firm FROM public.firm_members WHERE user_id = NEW.attorney_user_id LIMIT 1;
  payer := NEW.attorney_user_id;
  IF actual_firm IS NOT NULL THEN SELECT created_by INTO payer FROM public.firms WHERE id = actual_firm; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(payer::text, 772));
  SELECT price_id INTO plan FROM public.subscriptions WHERE user_id = payer
    AND environment = cfg.payment_environment AND status IN ('active','trialing','past_due','canceled')
    AND (current_period_end > now() OR (current_period_end IS NULL AND status <> 'canceled'))
    ORDER BY created_at DESC LIMIT 1;
  cap := CASE plan WHEN 'attorney_solo_v2_monthly' THEN 5 WHEN 'attorney_legal_aid_v2_monthly' THEN 5
    WHEN 'attorney_practice_v2_monthly' THEN 25 WHEN 'attorney_firm_v2_monthly' THEN 50 ELSE NULL END;
  IF cap IS NULL AND plan IN ('attorney_solo_monthly','attorney_firm_monthly','attorney_firm_charter_monthly','attorney_enterprise_monthly','attorney_portal_monthly_297') THEN RETURN NEW; END IF;
  IF cap IS NULL AND EXISTS (SELECT 1 FROM public.attorney_profiles WHERE user_id = NEW.attorney_user_id AND trial_ends_at > now()) THEN RETURN NEW; END IF;
  IF cap IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.attorney_conversion_accounts WHERE user_id = NEW.attorney_user_id AND approved_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Attorney access review is required';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.case_id IS NOT DISTINCT FROM OLD.case_id THEN RETURN NEW; END IF;
    IF NEW.case_id IS NULL THEN RAISE EXCEPTION 'This plan requires a share scoped to one case'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id = NEW.case_id AND user_id = NEW.client_user_id) THEN RAISE EXCEPTION 'The case must belong to the sharing client'; END IF;
    SELECT count(DISTINCT (l.client_user_id, coalesce(l.case_id, l.id))) INTO used
    FROM public.attorney_client_links l WHERE l.status = 'active' AND l.id <> NEW.id
      AND NOT (l.client_user_id = NEW.client_user_id AND l.case_id = NEW.case_id)
      AND (l.expires_at IS NULL OR l.expires_at > now())
      AND (CASE WHEN actual_firm IS NULL THEN l.attorney_user_id = payer
        ELSE l.attorney_user_id IN (SELECT user_id FROM public.firm_members WHERE firm_id = actual_firm) END);
    IF used >= cap THEN RAISE EXCEPTION 'Your plan has reached its active shared case limit'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO acct FROM public.attorney_conversion_accounts WHERE user_id = NEW.attorney_user_id FOR UPDATE;
  IF acct.approved_at IS NULL OR acct.free_matter_id IS NULL THEN RAISE EXCEPTION 'Complete access review and open your free matter before accepting a share'; END IF;
  IF NEW.case_id IS NULL THEN RAISE EXCEPTION 'The free case requires a share scoped to one case'; END IF;
  IF acct.free_link_id IS NOT NULL AND (acct.free_link_id <> NEW.id OR acct.free_case_id <> NEW.case_id) THEN
    RAISE EXCEPTION 'Your first case is free. To manage additional cases, choose a plan.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id = NEW.case_id AND user_id = NEW.client_user_id) THEN
    RAISE EXCEPTION 'The case must belong to the sharing client';
  END IF;
  UPDATE public.attorney_conversion_accounts SET free_link_id = NEW.id, free_case_id = NEW.case_id
    WHERE user_id = NEW.attorney_user_id;
  -- The matter attachment is performed by the attorney after acceptance. The claim is permanent.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_attorney_conversion_share_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER attorney_conversion_share_limit BEFORE INSERT OR UPDATE ON public.attorney_client_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_attorney_conversion_share_limit();

-- Keep the existing firm seat behavior, raising the ceiling only for the new 10-seat price.
CREATE OR REPLACE FUNCTION public.enforce_firm_seat_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limit integer; v_count integer; ceiling integer := 5;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.firm_id = OLD.firm_id THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.firms WHERE id = NEW.firm_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s JOIN public.firms f ON f.created_by = s.user_id
      JOIN public.attorney_conversion_settings cfg ON cfg.id = 1
    WHERE f.id = NEW.firm_id AND cfg.enabled AND s.environment = cfg.payment_environment
      AND s.price_id = 'attorney_firm_v2_monthly'
      AND s.status IN ('active','trialing','past_due','canceled')
      AND (s.current_period_end > now() OR (s.current_period_end IS NULL AND s.status <> 'canceled'))
  ) THEN ceiling := 10; END IF;
  SELECT least(ceiling, greatest(1,coalesce(seats_included,1)+coalesce(seats_purchased,0)))
    INTO v_limit FROM public.firms WHERE id = NEW.firm_id;
  IF v_limit IS NULL THEN RAISE EXCEPTION 'Firm not found'; END IF;
  SELECT count(*) INTO v_count FROM public.firm_members WHERE firm_id = NEW.firm_id AND user_id <> NEW.user_id;
  IF v_count >= v_limit THEN RAISE EXCEPTION 'This firm has reached its seat limit'; END IF;
  RETURN NEW;
END;
$$;

-- Nurture is separate, affirmative consent; old kit requests are never enrolled.
ALTER TABLE public.marketing_leads ADD COLUMN nurture_requested_at timestamptz;
CREATE TABLE public.attorney_nurture_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  consent_at timestamptz NOT NULL,
  confirmation_hash text NOT NULL UNIQUE,
  confirmation_expires_at timestamptz NOT NULL DEFAULT now() + interval '2 days',
  confirmed_at timestamptz,
  stopped_at timestamptz,
  next_step integer NOT NULL DEFAULT 1 CHECK (next_step BETWEEN 1 AND 5),
  next_due_at timestamptz,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorney_nurture_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_nurture_enrollments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attorney_nurture_enrollments TO service_role;
-- Direct public inserts bypass the server's rate/consent validation.
REVOKE INSERT ON public.marketing_leads FROM anon, authenticated;

CREATE FUNCTION public.claim_attorney_nurture_batch()
RETURNS SETOF public.attorney_nurture_enrollments
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.attorney_nurture_enrollments SET lease_until = now() + interval '5 minutes'
  WHERE id IN (
    SELECT id FROM public.attorney_nurture_enrollments
    WHERE confirmed_at IS NOT NULL AND stopped_at IS NULL AND next_step < 5
      AND next_due_at <= now() AND (lease_until IS NULL OR lease_until < now())
      AND EXISTS (SELECT 1 FROM public.attorney_conversion_settings WHERE id = 1 AND nurture_enabled)
    ORDER BY next_due_at LIMIT 10 FOR UPDATE SKIP LOCKED
  ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_attorney_nurture_batch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_attorney_nurture_batch() TO service_role;
CREATE VIEW public.attorney_conversion_metrics AS
SELECT
  (SELECT count(*) FROM public.marketing_leads WHERE persona = 'attorney') AS attorney_kit_requests,
  (SELECT count(*) FROM public.attorney_nurture_enrollments WHERE confirmed_at IS NOT NULL) AS confirmed_followup_enrollments,
  (SELECT count(*) FROM public.attorney_conversion_accounts WHERE approved_at IS NOT NULL) AS approved_attorney_workspaces,
  (SELECT count(*) FROM public.attorney_conversion_accounts WHERE free_matter_id IS NOT NULL) AS first_cases_started,
  (SELECT count(DISTINCT s.user_id) FROM public.subscriptions s JOIN public.attorney_conversion_settings cfg ON cfg.id = 1
    WHERE s.environment = cfg.payment_environment AND s.status = 'active'
      AND s.price_id IN ('attorney_solo_v2_monthly','attorney_legal_aid_v2_monthly','attorney_practice_v2_monthly','attorney_firm_v2_monthly')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())) AS active_v2_paying_accounts;
REVOKE ALL ON public.attorney_conversion_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.attorney_conversion_metrics TO service_role;
COMMIT;
