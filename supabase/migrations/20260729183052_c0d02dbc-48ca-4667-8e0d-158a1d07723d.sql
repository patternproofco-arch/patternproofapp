CREATE TABLE public.thread_source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  upload_index integer NOT NULL DEFAULT 0,
  sha256 text,
  bytes bigint,
  mime text,
  ocr_status text NOT NULL DEFAULT 'pending',
  ocr_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_source_documents TO authenticated;
GRANT ALL ON public.thread_source_documents TO service_role;

ALTER TABLE public.thread_source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own thread source documents"
  ON public.thread_source_documents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_thread_source_documents_thread ON public.thread_source_documents(thread_id);
CREATE INDEX idx_thread_source_documents_user ON public.thread_source_documents(user_id);

CREATE TRIGGER trg_thread_source_documents_updated_at
  BEFORE UPDATE ON public.thread_source_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.thread_message_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  source text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.thread_message_corrections TO authenticated;
GRANT ALL ON public.thread_message_corrections TO service_role;

ALTER TABLE public.thread_message_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own message corrections"
  ON public.thread_message_corrections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own message corrections"
  ON public.thread_message_corrections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_thread_message_corrections_message ON public.thread_message_corrections(message_id);

ALTER TABLE public.thread_messages
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.thread_source_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_side text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS date_confidence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS has_attachment_marker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_marker_text text,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric;

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS processed_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS attached_thread_ids uuid[] NOT NULL DEFAULT '{}';