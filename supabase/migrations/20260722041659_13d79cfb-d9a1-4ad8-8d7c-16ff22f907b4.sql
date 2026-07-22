ALTER TABLE public.attorney_client_links
  ADD COLUMN IF NOT EXISTS deposition_prep_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposition_prep_consent_at timestamptz;