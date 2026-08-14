-- 1. Org access requests (public intake)
CREATE TABLE public.org_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  contact_role text,
  survivors_per_month text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.org_access_requests TO anon, authenticated;
GRANT ALL ON public.org_access_requests TO service_role;

ALTER TABLE public.org_access_requests ENABLE ROW LEVEL SECURITY;

-- Intake only: anyone may submit a pending request. No SELECT/UPDATE/DELETE
-- policy exists, so no client role can ever read or modify these rows.
CREATE POLICY "Anyone can submit an org access request"
  ON public.org_access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);

CREATE OR REPLACE FUNCTION public.org_access_requests_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'org_access_requests.email must be a valid email address';
  END IF;
  IF NEW.status NOT IN ('pending','approved','denied') THEN
    RAISE EXCEPTION 'org_access_requests.status must be pending, approved or denied';
  END IF;
  NEW.org_name := btrim(NEW.org_name);
  NEW.contact_name := btrim(NEW.contact_name);
  IF length(NEW.org_name) = 0 OR length(NEW.org_name) > 200 THEN
    RAISE EXCEPTION 'org_access_requests.org_name must be 1-200 characters';
  END IF;
  IF length(NEW.contact_name) = 0 OR length(NEW.contact_name) > 120 THEN
    RAISE EXCEPTION 'org_access_requests.contact_name must be 1-120 characters';
  END IF;
  IF NEW.contact_role IS NOT NULL AND length(NEW.contact_role) > 120 THEN
    RAISE EXCEPTION 'org_access_requests.contact_role too long';
  END IF;
  IF NEW.survivors_per_month IS NOT NULL AND length(NEW.survivors_per_month) > 60 THEN
    RAISE EXCEPTION 'org_access_requests.survivors_per_month too long';
  END IF;
  IF NEW.message IS NOT NULL AND length(NEW.message) > 2000 THEN
    RAISE EXCEPTION 'org_access_requests.message too long';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER org_access_requests_validate
  BEFORE INSERT OR UPDATE ON public.org_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.org_access_requests_validate();

CREATE INDEX org_access_requests_status_idx ON public.org_access_requests (status, created_at DESC);

-- 2. Partner ownership on the existing referral registry
ALTER TABLE public.referral_links
  ADD COLUMN IF NOT EXISTS org_user_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.org_access_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS referral_links_org_user_idx ON public.referral_links (org_user_id);

GRANT SELECT ON public.referral_links TO authenticated;

-- Partner orgs may read ONLY the referral codes they own. There is still no
-- INSERT/UPDATE/DELETE policy: code creation and deactivation go through
-- server functions that verify the caller's role and ownership.
CREATE POLICY "Orgs can read their own referral codes"
  ON public.referral_links
  FOR SELECT
  TO authenticated
  USING (org_user_id = auth.uid());