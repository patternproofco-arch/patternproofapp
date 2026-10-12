-- Billing and identity: a signed-in attorney could PATCH their own attorney_profiles row
-- through the "Attorneys manage own profile" ALL policy (20260526165258) and set
-- trial_ends_at / trial_comped, which attorney_billing_state() treats as an active plan.
-- They could also INSERT their own row with a future trial, or change the profile email
-- that survivors were shown. No app code writes this table with a user JWT (every write
-- uses the server role), so callers with a JWT get an ALLOWLIST:
--   UPDATE: only full_name, firm_name, bar_number, jurisdiction, updated_at may change.
--           Everything else, including any column added later, is frozen (email,
--           trial_started_at, trial_ends_at, trial_comped, onboarded, role,
--           confidentiality_accepted_at, firm_id, user_id, created_at).
--   INSERT: trial / onboarding / role fields are forced to their defaults and email is
--           forced to the session's CONFIRMED auth email (NULL, so the insert fails, if
--           the account email is unconfirmed).
-- Callers without a JWT (auth.uid() IS NULL: service_role server functions, SQL editor,
-- SECURITY DEFINER RPCs run by the server) bypass, so the audited server paths keep working.
-- Profile emails follow auth: when an account's confirmed email changes, the attorney and
-- advocate profile copies are updated (never blocking the auth change itself).
-- Apply after the #214 bring-up paste. Re-runnable.
CREATE OR REPLACE FUNCTION public.attorney_profiles_owner_update_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  allowed constant text[] := ARRAY['full_name','firm_name','bar_number','jurisdiction','updated_at'];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (pg_catalog.to_jsonb(NEW) - allowed) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION 'Only profile details can be edited here. Email, trial, billing, onboarding and firm fields are managed by PatternProof.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER only to read the caller's own confirmed email from auth.users.
CREATE OR REPLACE FUNCTION public.attorney_profiles_owner_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.email := (SELECT pg_catalog.lower(u.email) FROM auth.users u
                WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL);
  NEW.trial_started_at := NULL;
  NEW.trial_ends_at := NULL;
  NEW.trial_comped := false;
  NEW.onboarded := false;
  NEW.role := NULL;
  NEW.confidentiality_accepted_at := NULL;
  RETURN NEW;
END;
$$;

-- Keep the display copies of the profile email equal to the confirmed auth email.
CREATE OR REPLACE FUNCTION public.sync_profile_emails_from_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _email text := pg_catalog.lower(NEW.email);
BEGIN
  IF NEW.email IS NULL OR NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  BEGIN
    UPDATE public.attorney_profiles SET email = _email, updated_at = now()
     WHERE user_id = NEW.id AND email IS DISTINCT FROM _email;
    IF pg_catalog.to_regclass('public.advocate_profiles') IS NOT NULL THEN
      UPDATE public.advocate_profiles SET email = _email, updated_at = now()
       WHERE user_id = NEW.id AND email IS DISTINCT FROM _email;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block a sign-in or email change because a display copy could not be synced.
    RAISE WARNING 'profile email sync skipped for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.attorney_profiles_owner_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attorney_profiles_owner_insert_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_emails_from_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS attorney_profiles_owner_update_guard ON public.attorney_profiles;
CREATE TRIGGER attorney_profiles_owner_update_guard
  BEFORE UPDATE ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attorney_profiles_owner_update_guard();

DROP TRIGGER IF EXISTS attorney_profiles_owner_insert_guard ON public.attorney_profiles;
CREATE TRIGGER attorney_profiles_owner_insert_guard
  BEFORE INSERT ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attorney_profiles_owner_insert_guard();

DROP TRIGGER IF EXISTS sync_profile_emails_from_auth ON auth.users;
CREATE TRIGGER sync_profile_emails_from_auth
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_emails_from_auth();
