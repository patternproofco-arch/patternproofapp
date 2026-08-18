
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  model text,
  file_type text,
  evidence_id uuid,
  thread_id uuid,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  http_status integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_log_select_own" ON public.ai_usage_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ai_usage_log_insert_own" ON public.ai_usage_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX ai_usage_log_user_created_idx ON public.ai_usage_log (user_id, created_at DESC);

CREATE TABLE public.evidence_incident_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  source text NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_excerpt text,
  frame_count integer NOT NULL DEFAULT 0,
  model text,
  status text NOT NULL DEFAULT 'pending',
  created_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_incident_drafts TO authenticated;
GRANT ALL ON public.evidence_incident_drafts TO service_role;
ALTER TABLE public.evidence_incident_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_drafts_own" ON public.evidence_incident_drafts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX evidence_incident_drafts_user_status_idx ON public.evidence_incident_drafts (user_id, status, created_at DESC);
CREATE TRIGGER evidence_incident_drafts_touch BEFORE UPDATE ON public.evidence_incident_drafts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
