-- Proposed incident entries generated from uploads (photos, video transcripts,
-- message threads, voice notes). Nothing becomes a real incident until the
-- survivor explicitly accepts (or edits then accepts).

CREATE TABLE IF NOT EXISTS public.proposed_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sort_key text,
  date_certainty text NOT NULL DEFAULT 'unknown'
    CHECK (date_certainty IN ('confirmed', 'approximate', 'unknown')),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  source_summary text,
  confidence_notes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'denied', 'edited')),
  created_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposed_incidents_user_status_idx
  ON public.proposed_incidents(user_id, status);
CREATE INDEX IF NOT EXISTS proposed_incidents_batch_idx
  ON public.proposed_incidents(batch_id);

ALTER TABLE public.proposed_incidents ENABLE ROW LEVEL SECURITY;

-- Survivors can only see and act on their own proposals.
CREATE POLICY proposed_incidents_select_own
  ON public.proposed_incidents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY proposed_incidents_update_own
  ON public.proposed_incidents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts are performed by service-role server functions only.
REVOKE ALL ON public.proposed_incidents FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.proposed_incidents TO authenticated;
GRANT ALL ON public.proposed_incidents TO service_role;
