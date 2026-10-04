-- Grant report workspace: saved drafts with an explicit review → approve → export →
-- staff-recorded receipt lifecycle.
--
-- Honesty rules enforced here, not just in the UI:
--  * 'submitted' can only be set together with a receipt recorded by a person.
--    PatternProof has no connection to any funder's system, so no row can claim
--    electronic delivery.
--  * An approved or exported draft always carries the fingerprint of the exact
--    content that was approved.
--
-- Contains aggregate numbers and staff-written text only. No survivor ids or names.
-- Access: server functions only (service role) after an owner/admin check. RLS is
-- on with no policies, so no signed-in user can read or write it directly.
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.org_grant_report_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.dv_organizations(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  -- Staff entries, per row: state, count, text, note (see grant-report-model.ts).
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Numbers computed from records the last time they were refreshed or approved.
  derived jsonb NOT NULL DEFAULT '{}'::jsonb,
  derived_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'exported', 'submitted')),
  version integer NOT NULL DEFAULT 1,
  approved_hash text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  exported_at timestamptz,
  export_count integer NOT NULL DEFAULT 0,
  receipt jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_from <= period_to),
  -- approved / exported / submitted always say which content was approved.
  CHECK (status = 'draft' OR (approved_hash IS NOT NULL AND approved_at IS NOT NULL)),
  -- submitted only with a person-recorded receipt, never on its own.
  CHECK (
    status <> 'submitted'
    OR (
      receipt IS NOT NULL
      AND receipt ->> 'method' = 'staff_recorded'
      AND nullif(trim(receipt ->> 'destination'), '') IS NOT NULL
      AND submitted_at IS NOT NULL
      AND submitted_by IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS org_grant_report_drafts_org_idx
  ON public.org_grant_report_drafts (org_id, updated_at DESC);

ALTER TABLE public.org_grant_report_drafts ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: only the server (service role) touches this table.
REVOKE ALL ON public.org_grant_report_drafts FROM anon, authenticated;

COMMENT ON TABLE public.org_grant_report_drafts IS
  'Org grant report drafts. status submitted means staff recorded a receipt; it is never set by an integration.';
