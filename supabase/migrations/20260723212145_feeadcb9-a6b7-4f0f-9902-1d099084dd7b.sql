
-- 1. referral_links: admin-managed table mapping short codes to DV org names.
CREATE TABLE public.referral_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_name text NOT NULL,
  code text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.referral_links TO service_role;
-- No anon/authenticated grants: all reads/writes go through server functions
-- using the service-role client. This table is managed internally.

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
-- No policies: locked to service_role only.

-- 2. Extend the existing survivor-referrals table with the referred-by code.
--    Existing columns (org_slug, referred_by_org_name) are relaxed to nullable
--    so new signups only need to persist the resolved code.
ALTER TABLE public.user_referrals
  ADD COLUMN IF NOT EXISTS referred_by_code text;

ALTER TABLE public.user_referrals
  ALTER COLUMN org_slug DROP NOT NULL,
  ALTER COLUMN referred_by_org_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS user_referrals_referred_by_code_idx
  ON public.user_referrals (referred_by_code);
