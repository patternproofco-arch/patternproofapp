
-- Tables
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME,
  location TEXT,
  description TEXT NOT NULL,
  abuse_types TEXT[] NOT NULL DEFAULT '{}',
  witnesses TEXT,
  emotional_impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  linked_incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_party TEXT,
  relationship_type TEXT,
  case_types TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction TEXT,
  pattern_summary TEXT,
  highlighted_incident_ids UUID[] NOT NULL DEFAULT '{}',
  attached_evidence_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own incidents" ON public.incidents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own evidence" ON public.evidence FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own voice_notes" ON public.voice_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cases" ON public.cases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger for cases
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER cases_touch_updated_at BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage buckets (private)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('evidence-files', 'evidence-files', false),
  ('voice-notes', 'voice-notes', false);

-- Storage RLS: users access only files under their own user_id folder
CREATE POLICY "evidence read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence delete own" ON storage.objects FOR DELETE
  USING (bucket_id = 'evidence-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "voice insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "voice delete own" ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
