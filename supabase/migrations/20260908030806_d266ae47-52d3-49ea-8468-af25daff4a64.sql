ALTER TABLE public.advocate_client_links
  ADD COLUMN IF NOT EXISTS org_admin_visibility boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS org_visibility_updated_at timestamptz;

ALTER TABLE public.advocate_survivor_invites
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS email_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_error text;

ALTER TABLE public.advocate_survivor_invites
  DROP CONSTRAINT IF EXISTS advocate_survivor_invites_email_status_check;
ALTER TABLE public.advocate_survivor_invites
  ADD CONSTRAINT advocate_survivor_invites_email_status_check
  CHECK (email_status IN ('not_sent','sent','failed'));

ALTER TABLE public.org_access_requests
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS org_type text,
  ADD COLUMN IF NOT EXISTS contact_consent boolean NOT NULL DEFAULT false;