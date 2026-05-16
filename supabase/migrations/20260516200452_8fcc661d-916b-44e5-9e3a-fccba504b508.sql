
-- Enums
DO $$ BEGIN
  CREATE TYPE public.attorney_type AS ENUM ('attorney', 'advocate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.access_level AS ENUM ('full', 'court_packet_only', 'incidents_only', 'evidence_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.opra_status AS ENUM ('draft', 'sent', 'response_received');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  actor text NOT NULL DEFAULT 'survivor',
  record_reference text,
  timestamp_utc timestamptz NOT NULL DEFAULT now(),
  entry_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit" ON public.audit_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_audit_log_user_time ON public.audit_log(user_id, timestamp_utc DESC);

-- attorney_access
CREATE TABLE public.attorney_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attorney_email text NOT NULL,
  attorney_name text NOT NULL,
  attorney_type public.attorney_type NOT NULL DEFAULT 'attorney',
  access_level public.access_level NOT NULL DEFAULT 'full',
  shared_incident_ids uuid[] NOT NULL DEFAULT '{}',
  shared_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  include_escalation boolean NOT NULL DEFAULT false,
  access_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorney_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attorney_access" ON public.attorney_access FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- recordings
CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  audio_url text NOT NULL,
  transcript text,
  duration_seconds integer,
  linked_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  recording_started_at timestamptz,
  recording_ended_at timestamptz,
  state_recorded_in text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recordings" ON public.recordings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- escalation_flags
CREATE TABLE public.escalation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flag_type text NOT NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  severity_tier integer NOT NULL CHECK (severity_tier BETWEEN 1 AND 3),
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);
ALTER TABLE public.escalation_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own escalation_flags" ON public.escalation_flags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- opra_requests
CREATE TABLE public.opra_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agency_name text,
  agency_address text,
  custodian_title text,
  record_types text[] NOT NULL DEFAULT '{}',
  date_range_start date,
  date_range_end date,
  additional_details text,
  generated_letter text,
  status public.opra_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opra_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opra_requests" ON public.opra_requests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- column additions
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS severity_level integer,
  ADD COLUMN IF NOT EXISTS has_escalation_flag boolean NOT NULL DEFAULT false;

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS linked_recording_id uuid REFERENCES public.recordings(id) ON DELETE SET NULL;

-- storage bucket for conversation recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('conversation-recordings', 'conversation-recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own conv recordings read" ON storage.objects FOR SELECT
  USING (bucket_id = 'conversation-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own conv recordings write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'conversation-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own conv recordings delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'conversation-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
