CREATE OR REPLACE FUNCTION public.touch_attorney_case_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.attorney_case_notes IS DISTINCT FROM OLD.attorney_case_notes THEN
    NEW.attorney_case_notes_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
DO $$
DECLARE
  r record;
  cfg text;
  has_search_path boolean;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args, p.proconfig AS proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private') AND p.prokind = 'f' AND p.proname NOT LIKE 'pg_%'
  LOOP
    has_search_path := false;
    IF r.proconfig IS NOT NULL THEN
      FOREACH cfg IN ARRAY r.proconfig LOOP
        IF cfg LIKE 'search_path=%' THEN has_search_path := true; EXIT; END IF;
      END LOOP;
    END IF;
    IF NOT has_search_path THEN
      EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.schema_name, r.func_name, r.identity_args);
    END IF;
  END LOOP;
END;
$$;