ALTER TABLE public.attorney_profiles
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS confidentiality_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;