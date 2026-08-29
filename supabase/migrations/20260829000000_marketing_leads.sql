-- Lead-magnet capture: attorneys and DV orgs opt in for a free readiness kit
-- in exchange for an email (and, for these two audiences only, phone).
-- Modeled directly on the feedback_submissions RLS pattern: anon/authenticated
-- may INSERT only, no SELECT/UPDATE/DELETE for either role — reads are
-- service-role only.

CREATE TABLE public.marketing_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NULL,
  email text NOT NULL,
  phone text NULL,
  persona text NOT NULL CHECK (persona IN ('attorney', 'org')),
  source_page text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.marketing_leads TO anon;
GRANT INSERT ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- No user_id column here (these are pre-signup marketing opt-ins, often from
-- logged-out visitors), so the same unconditional WITH CHECK applies to both
-- roles rather than feedback_submissions' per-role attribution split.
CREATE POLICY "Anyone can submit a marketing lead"
  ON public.marketing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_marketing_leads_persona_created ON public.marketing_leads (persona, created_at DESC);
