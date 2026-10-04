-- Forgot-PIN reset, and closing a hole in the app lock.
--
-- 1. user_security_settings held the PIN hash and salt, and let any signed-in browser read
--    AND UPDATE its own row directly (owner RLS policies plus table-level grants). That meant
--    a signed-in session could clear pin_hash or the lockout counters and skip the lock, or read
--    the hash of a 4-digit PIN and recover it offline. Nothing in the app touches this table from
--    the browser: every read and write goes through server functions using the service role.
--    So direct access is removed.
-- 2. Counters for the forgot-PIN reset (separate from PIN tries). Without these columns the reset
--    refuses to run.
--
-- Grace: apply on muy only. Do not apply from CI/agent.

ALTER TABLE public.user_security_settings
  ADD COLUMN IF NOT EXISTS reset_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_locked_until timestamptz;

DROP POLICY IF EXISTS "own security settings read" ON public.user_security_settings;
DROP POLICY IF EXISTS "own security settings insert" ON public.user_security_settings;
DROP POLICY IF EXISTS "own security settings update" ON public.user_security_settings;

REVOKE ALL ON public.user_security_settings FROM anon, authenticated;
GRANT ALL ON public.user_security_settings TO service_role;
