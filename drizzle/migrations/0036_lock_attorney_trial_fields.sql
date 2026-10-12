-- Billing: a signed-in attorney could PATCH their own attorney_profiles row through the
-- "Attorneys manage own profile" ALL policy (20260526165258) and set trial_ends_at /
-- trial_comped, which attorney_billing_state() treats as an active plan. They could also
-- INSERT their own row with a future trial. No app code writes this table with a user JWT
-- (every write uses the server role), so callers with a JWT get an ALLOWLIST:
--   UPDATE: only full_name, firm_name, bar_number, jurisdiction, email, updated_at may
--           change. Everything else, including any column added later, is frozen
--           (trial_started_at, trial_ends_at, trial_comped, onboarded, role,
--           confidentiality_accepted_at, firm_id, user_id, created_at).
--   INSERT: trial / onboarding / role fields are forced to their defaults.
-- Callers without a JWT (auth.uid() IS NULL: service_role server functions, SQL editor,
-- SECURITY DEFINER RPCs run by the server) bypass, so the audited server paths keep working.
-- Apply after the #214 bring-up paste. Re-runnable.
CREATE OR REPLACE FUNCTION public.attorney_profiles_owner_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  allowed constant text[] := ARRAY['full_name','firm_name','bar_number','jurisdiction','email','updated_at'];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (pg_catalog.to_jsonb(NEW) - allowed) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION 'Only profile details can be edited here. Trial, billing, onboarding and firm fields are managed by PatternProof.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.attorney_profiles_owner_insert_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.trial_started_at := NULL;
  NEW.trial_ends_at := NULL;
  NEW.trial_comped := false;
  NEW.onboarded := false;
  NEW.role := NULL;
  NEW.confidentiality_accepted_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.attorney_profiles_owner_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attorney_profiles_owner_insert_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS attorney_profiles_owner_update_guard ON public.attorney_profiles;
CREATE TRIGGER attorney_profiles_owner_update_guard
  BEFORE UPDATE ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attorney_profiles_owner_update_guard();

DROP TRIGGER IF EXISTS attorney_profiles_owner_insert_guard ON public.attorney_profiles;
CREATE TRIGGER attorney_profiles_owner_insert_guard
  BEFORE INSERT ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attorney_profiles_owner_insert_guard();
