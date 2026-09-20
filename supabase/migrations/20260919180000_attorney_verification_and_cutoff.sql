-- Attorney bar verification and case-access cutoff.
--
-- Two things ship together because they gate the same door:
--   1. An attorney account cannot see real survivor data until a human
--      reviewer verifies it (bar_number/jurisdiction is currently
--      self-reported and never checked). Declining starts a 90-day wait
--      before reapplying. Suspending an attorney cuts off everyone whose
--      access chains through them (firm colleagues, added staff) on their
--      very next request, not on a cache expiry.
--   2. An attorney_client_link that nobody reconfirms goes stale after 180
--      days rather than staying open forever. The previous plan cut access
--      the instant day 180 passed with no warning, which could land access
--      loss in the middle of an active court date. This adds reminders at
--      150/165/175 days and a 7-day-out in-app notice to the survivor with a
--      one-tap way to keep access going — access still ends on day 180 if
--      nobody acts.

-- 1. Attorney verification lifecycle -------------------------------------

ALTER TABLE public.attorney_profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.attorney_profiles
    ADD CONSTRAINT attorney_profiles_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'declined', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- This is a new gate. Every attorney account that already exists predates
-- it and is not retroactively locked out of case files they already hold —
-- only accounts created after this migration start at 'pending' and need a
-- reviewer decision before they can open a survivor's file.
UPDATE public.attorney_profiles
SET verification_status = 'verified', verified_at = now()
WHERE verification_status = 'pending';

-- 2. Reviewer decision log -------------------------------------------------
-- Who decided, when, on what evidence, and why — for every verify, decline,
-- suspend and reinstatement. Nothing overwrites a prior row.

CREATE TABLE IF NOT EXISTS public.attorney_verification_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('verified', 'declined', 'suspended', 'reinstated')),
  evidence text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attorney_verification_decisions_attorney_idx
  ON public.attorney_verification_decisions(attorney_user_id, created_at DESC);

ALTER TABLE public.attorney_verification_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_verification_decisions FROM anon, authenticated;
GRANT ALL ON public.attorney_verification_decisions TO service_role;

-- 3. Case-access reconfirmation cutoff ------------------------------------

ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reminder_150_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_165_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_175_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS survivor_notice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cutoff_at timestamptz;

-- Existing active links start their 180-day clock now, not at their
-- original (possibly very old) created_at, so nobody is cut off on day one
-- of this feature shipping.
UPDATE public.attorney_client_links
SET last_confirmed_at = now()
WHERE status = 'active';

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

-- In-app-only survivor notice: "your attorney's access is about to expire,
-- keep it going with one tap." Never emailed or texted — read via a server
-- function like every other table in this file, not queried directly from
-- the browser.
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

-- 4. Incident location is a potential home address -------------------------
-- Evidence GPS is already fully stripped before reaching an attorney
-- (attorney-portal.functions.ts). The incident `location` text field had no
-- equivalent gate — it flowed to every attorney share unconditionally.
-- Default off, per incident, same shape as evidence.gps_reveal_opt_in.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS location_reveal_opt_in boolean NOT NULL DEFAULT false;
