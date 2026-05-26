
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  time time,
  channel text NOT NULL CHECK (channel IN ('text','call','email','voicemail','social','in_person','other')),
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing','missed')),
  from_party text,
  content text,
  screenshot_url text,
  linked_incident_id uuid,
  harassment_flag boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own communications" ON public.communications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_communications_user_date ON public.communications(user_id, date DESC);

CREATE TRIGGER trg_communications_updated_at
  BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.pattern_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis jsonb NOT NULL,
  incident_count_at_time integer NOT NULL DEFAULT 0,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pattern_analyses TO authenticated;
GRANT ALL ON public.pattern_analyses TO service_role;

ALTER TABLE public.pattern_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pattern_analyses" ON public.pattern_analyses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pattern_analyses_user ON public.pattern_analyses(user_id, created_at DESC);

ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending','processing','complete','failed','too_long'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='own exports read') THEN
    CREATE POLICY "own exports read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='own exports insert') THEN
    CREATE POLICY "own exports insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='own exports delete') THEN
    CREATE POLICY "own exports delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
