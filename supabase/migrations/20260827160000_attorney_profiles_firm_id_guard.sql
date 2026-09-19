-- attorney_profiles.firm_id was directly user-editable (via the existing
-- "Attorneys manage own profile" ALL policy) with nothing checking it against
-- real firm membership. Read-access to colleague data was already fixed to
-- key off firm_members instead, but a user could still set their own
-- firm_id to any firm's id and appear in that firm's roster to real members
-- (impersonation risk). This trigger requires firm_id to match an existing
-- firm_members row for that user before it can be set.
CREATE OR REPLACE FUNCTION public.attorney_profiles_firm_id_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.firm_members
    WHERE user_id = NEW.user_id AND firm_id = NEW.firm_id
  ) THEN
    RAISE EXCEPTION 'You are not a member of that firm.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attorney_profiles_firm_id_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS attorney_profiles_firm_id_guard ON public.attorney_profiles;
CREATE TRIGGER attorney_profiles_firm_id_guard
  BEFORE INSERT OR UPDATE OF firm_id ON public.attorney_profiles
  FOR EACH ROW EXECUTE FUNCTION public.attorney_profiles_firm_id_guard();
