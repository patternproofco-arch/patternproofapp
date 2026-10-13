ALTER TABLE public.user_security_settings
  ADD COLUMN IF NOT EXISTS reset_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_locked_until timestamptz;
DROP POLICY IF EXISTS "own security settings read" ON public.user_security_settings;
DROP POLICY IF EXISTS "own security settings insert" ON public.user_security_settings;
DROP POLICY IF EXISTS "own security settings update" ON public.user_security_settings;
REVOKE ALL ON public.user_security_settings FROM anon, authenticated;
GRANT ALL ON public.user_security_settings TO service_role;