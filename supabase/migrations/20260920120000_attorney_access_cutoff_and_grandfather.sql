-- Additive cutoff + grandfather on top of the professional verification gate.
-- Soft claim (docs/reviews/reconciled-verification-gate.md): grandfathered
-- Verified = YES is NOT a fresh bar re-check. New shares still run
-- assertAttorneyVerified (profile + every jurisdiction).

-- 1. Reminder / cutoff columns on attorney_client_links -----------------------
ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS reminder_150_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_165_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_175_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS survivor_notice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cutoff_at timestamptz;

-- Existing active links start their 180-day clock now (not at possibly-ancient
-- created_at), so nobody is cut off the day this ships.
UPDATE public.attorney_client_links
SET case_engagement_confirmed_at = coalesce(case_engagement_confirmed_at, now())
WHERE status = 'active';

-- 2. Confirmations + in-app survivor notices ---------------------------------
CREATE TABLE IF NOT EXISTS public.attorney_access_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_role text NOT NULL CHECK (confirmed_role IN ('attorney', 'survivor')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attorney_access_confirmations_link_idx
  ON public.attorney_access_confirmations(link_id, created_at DESC);
ALTER TABLE public.attorney_access_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_access_confirmations FROM anon, authenticated;
GRANT ALL ON public.attorney_access_confirmations TO service_role;

CREATE TABLE IF NOT EXISTS public.attorney_access_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_type text NOT NULL CHECK (notice_type IN ('cutoff_warning')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  action text CHECK (action IN ('kept_access')),
  action_at timestamptz
);
CREATE INDEX IF NOT EXISTS attorney_access_notices_client_idx
  ON public.attorney_access_notices(client_user_id, created_at DESC);
ALTER TABLE public.attorney_access_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_access_notices FROM anon, authenticated;
GRANT ALL ON public.attorney_access_notices TO service_role;

-- 3. Query-time day-180 fail-closed (SQL helper) ------------------------------
CREATE OR REPLACE FUNCTION public.attorney_case_engagement_current(
  p_linked_at timestamptz,
  p_confirmed_at timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_confirmed_at, p_linked_at) IS NULL THEN false
    WHEN coalesce(p_confirmed_at, p_linked_at) > now() THEN false
    WHEN coalesce(p_confirmed_at, p_linked_at) > (now() - interval '180 days') THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.attorney_case_engagement_current(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attorney_case_engagement_current(timestamptz, timestamptz)
  TO service_role;

-- 4. Incident location redacted by default for attorney reads ----------------
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS location_reveal_opt_in boolean NOT NULL DEFAULT false;

-- 5. Grandfather existing live attorneys → Verified = YES (SOFT CLAIM) -------
-- Soft claim: this is NOT a fresh bar re-check. It only prevents locking out
-- accounts that already held live access before the gate shipped. Every NEW
-- share still calls assertAttorneyVerified (profile + every jurisdiction).
UPDATE public.attorney_profiles
SET
  verification_status = 'verified',
  verified_at = coalesce(verified_at, now()),
  verification_expires_at = coalesce(
    verification_expires_at,
    now() + interval '365 days'
  )
WHERE verification_status = 'pending';

UPDATE public.attorney_bar_jurisdictions j
SET
  verification_status = 'verified',
  verified_at = coalesce(j.verified_at, now()),
  verification_expires_at = coalesce(
    j.verification_expires_at,
    now() + interval '365 days'
  )
FROM public.attorney_profiles p
WHERE j.attorney_user_id = p.user_id
  AND p.verification_status = 'verified'
  AND j.verification_status = 'pending';

INSERT INTO public.attorney_bar_jurisdictions (
  attorney_user_id,
  jurisdiction,
  bar_number,
  verification_status,
  verified_at,
  verification_expires_at
)
SELECT
  p.user_id,
  coalesce(nullif(trim(p.jurisdiction), ''), 'UNSPECIFIED'),
  nullif(trim(p.bar_number), ''),
  'verified',
  now(),
  now() + interval '365 days'
FROM public.attorney_profiles p
WHERE p.verification_status = 'verified'
  AND NOT EXISTS (
    SELECT 1 FROM public.attorney_bar_jurisdictions j
    WHERE j.attorney_user_id = p.user_id
  )
ON CONFLICT DO NOTHING;
