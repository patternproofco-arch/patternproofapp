-- Fix Supabase lint 0011_function_search_path_mutable ("Function Search Path Mutable").
-- Grace cannot Publish while Detected Issues flags functions without an
-- immutable search_path. Prefer ALTER/CREATE … SET search_path (does not
-- weaken RLS). Match project convention: search_path = public.
--
-- Known migration offender: 20260917143533_attorney_case_notes_updated_at.sql
-- created touch_attorney_case_notes_updated_at() without search_path.
-- Also re-assert touch_updated_at() and catch any other public/private
-- functions still missing search_path on live DB.

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

-- Idempotent: early follow-up migration already set this; safe if already set.
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- Catch-all for any remaining user functions in public/private without search_path.
-- Skip functions that already pin search_path (e.g. email helpers use public, pgmq).
DO $$
DECLARE
  r record;
  cfg text;
  has_search_path boolean;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      p.proconfig AS proconfig
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prokind = 'f'
      AND p.proname NOT LIKE 'pg_%'
  LOOP
    has_search_path := false;
    IF r.proconfig IS NOT NULL THEN
      FOREACH cfg IN ARRAY r.proconfig LOOP
        IF cfg LIKE 'search_path=%' THEN
          has_search_path := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT has_search_path THEN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public',
        r.schema_name,
        r.func_name,
        r.identity_args
      );
      RAISE NOTICE 'Set search_path=public on %.%(%)',
        r.schema_name, r.func_name, r.identity_args;
    END IF;
  END LOOP;
END;
$$;
