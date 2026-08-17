-- 1. Sealed evidence (additive, default false = current behaviour)
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS is_sealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz;

-- 2. Record requests
CREATE TABLE IF NOT EXISTS public.record_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL,
  survivor_user_id uuid NOT NULL,
  org_name text,
  purpose text NOT NULL,
  date_start date,
  date_end date,
  topics text[] NOT NULL DEFAULT '{}',
  source_types text[] NOT NULL DEFAULT '{}',
  include_incidents boolean NOT NULL DEFAULT true,
  include_evidence boolean NOT NULL DEFAULT true,
  incident_ids uuid[],
  evidence_ids uuid[],
  expires_at timestamptz,
  download_allowed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  scope_summary text,
  survivor_note text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.record_requests TO authenticated;
GRANT ALL ON public.record_requests TO service_role;
ALTER TABLE public.record_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester reads own requests" ON public.record_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_user_id);
CREATE POLICY "Survivor reads requests sent to them" ON public.record_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = survivor_user_id AND status <> 'draft');
CREATE POLICY "Requester creates own requests" ON public.record_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_user_id);
CREATE POLICY "Requester updates own requests" ON public.record_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = requester_user_id) WITH CHECK (auth.uid() = requester_user_id);
CREATE POLICY "Survivor responds to their requests" ON public.record_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = survivor_user_id) WITH CHECK (auth.uid() = survivor_user_id);

CREATE INDEX IF NOT EXISTS record_requests_survivor_idx
  ON public.record_requests (survivor_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS record_requests_requester_idx
  ON public.record_requests (requester_user_id, created_at DESC);

CREATE TRIGGER record_requests_touch
  BEFORE UPDATE ON public.record_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Consent grants
CREATE TABLE IF NOT EXISTS public.consent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_user_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  org_name text,
  request_id uuid REFERENCES public.record_requests(id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  download_allowed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  revoked_at timestamptz,
  revocation_reason text,
  receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.consent_grants TO authenticated;
GRANT ALL ON public.consent_grants TO service_role;
ALTER TABLE public.consent_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survivor reads own grants" ON public.consent_grants
  FOR SELECT TO authenticated USING (auth.uid() = survivor_user_id);
CREATE POLICY "Recipient reads grants issued to them" ON public.consent_grants
  FOR SELECT TO authenticated USING (auth.uid() = recipient_user_id);
CREATE POLICY "Survivor updates own grants" ON public.consent_grants
  FOR UPDATE TO authenticated
  USING (auth.uid() = survivor_user_id) WITH CHECK (auth.uid() = survivor_user_id);

CREATE INDEX IF NOT EXISTS consent_grants_survivor_idx
  ON public.consent_grants (survivor_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS consent_grants_recipient_idx
  ON public.consent_grants (recipient_user_id, status, created_at DESC);

CREATE TRIGGER consent_grants_touch
  BEFORE UPDATE ON public.consent_grants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Organization follow-ups / warm handoffs (coordination only, never evidence)
CREATE TABLE IF NOT EXISTS public.org_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_user_id uuid NOT NULL,
  survivor_user_id uuid,
  grant_id uuid REFERENCES public.consent_grants(id) ON DELETE SET NULL,
  reference_label text,
  resource_reference text,
  status text NOT NULL DEFAULT 'offered',
  due_at timestamptz,
  note text,
  created_by uuid NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.org_follow_ups TO authenticated;
GRANT ALL ON public.org_follow_ups TO service_role;
ALTER TABLE public.org_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org reads own follow-ups" ON public.org_follow_ups
  FOR SELECT TO authenticated USING (auth.uid() = org_user_id);
CREATE POLICY "Org creates own follow-ups" ON public.org_follow_ups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = org_user_id);
CREATE POLICY "Org updates own follow-ups" ON public.org_follow_ups
  FOR UPDATE TO authenticated
  USING (auth.uid() = org_user_id) WITH CHECK (auth.uid() = org_user_id);

CREATE INDEX IF NOT EXISTS org_follow_ups_org_idx
  ON public.org_follow_ups (org_user_id, status, due_at);

CREATE TRIGGER org_follow_ups_touch
  BEFORE UPDATE ON public.org_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Referral engagements (workflow status only; grants no record access)
CREATE TABLE IF NOT EXISTS public.referral_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_user_id uuid NOT NULL,
  survivor_user_id uuid,
  referral_code text,
  status text NOT NULL DEFAULT 'offered',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.referral_engagements TO authenticated;
GRANT ALL ON public.referral_engagements TO service_role;
ALTER TABLE public.referral_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org reads own referral engagements" ON public.referral_engagements
  FOR SELECT TO authenticated USING (auth.uid() = org_user_id);
CREATE POLICY "Survivor reads engagements about them" ON public.referral_engagements
  FOR SELECT TO authenticated USING (auth.uid() = survivor_user_id);
CREATE POLICY "Org creates own referral engagements" ON public.referral_engagements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = org_user_id);
CREATE POLICY "Org updates own referral engagements" ON public.referral_engagements
  FOR UPDATE TO authenticated
  USING (auth.uid() = org_user_id) WITH CHECK (auth.uid() = org_user_id);

CREATE INDEX IF NOT EXISTS referral_engagements_org_idx
  ON public.referral_engagements (org_user_id, status, created_at DESC);

CREATE TRIGGER referral_engagements_touch
  BEFORE UPDATE ON public.referral_engagements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();