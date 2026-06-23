
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('pdf','csv','excel','txt','rsmf','zip')),
  source_filename text NOT NULL,
  file_url text NOT NULL,
  conversation_participant text,
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending','parsed','partial','failed','queued')),
  parse_error text,
  message_count integer NOT NULL DEFAULT 0,
  summary text,
  attorney_summary text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  exhibit_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT ALL ON public.message_threads TO service_role;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own message_threads" ON public.message_threads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  sender text,
  recipient text,
  sent_on date,
  sent_at_time time,
  body text,
  attachment_name text,
  attachment_url text,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_messages TO authenticated;
GRANT ALL ON public.thread_messages TO service_role;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own thread_messages" ON public.thread_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_thread_messages_thread ON public.thread_messages(thread_id, position);
CREATE INDEX idx_message_threads_user ON public.message_threads(user_id, created_at DESC);

CREATE TRIGGER trg_message_threads_touch
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies for the message-exports bucket (per-user folder)
CREATE POLICY "users read own message-exports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'message-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users upload own message-exports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users update own message-exports" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'message-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own message-exports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'message-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
