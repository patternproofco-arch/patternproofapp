ALTER TABLE public.attorney_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_comped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS attorney_profiles_trial_ends_at_idx
  ON public.attorney_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;