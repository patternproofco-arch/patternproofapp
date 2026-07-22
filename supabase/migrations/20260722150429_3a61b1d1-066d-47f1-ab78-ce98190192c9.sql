
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS charter_rate_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_referrals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_by_org_name text NOT NULL,
  org_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_referrals TO authenticated;
GRANT ALL ON public.user_referrals TO service_role;

ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral row"
  ON public.user_referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral row"
  ON public.user_referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_referrals_slug ON public.user_referrals(org_slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_tier ON public.subscriptions(plan_tier) WHERE plan_tier IS NOT NULL;
