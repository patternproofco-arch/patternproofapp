CREATE TABLE IF NOT EXISTS public.attorney_entry_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'needs_clarification', 'reviewed')),
  reviewed_marker text,
  attorney_note text NOT NULL DEFAULT '',
  question_request_id uuid REFERENCES public.attorney_document_requests(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, user_id, item_key)
);
CREATE INDEX IF NOT EXISTS attorney_entry_reviews_link_idx ON public.attorney_entry_reviews (link_id, user_id);
REVOKE ALL ON public.attorney_entry_reviews FROM anon, authenticated;
GRANT ALL ON public.attorney_entry_reviews TO service_role;
ALTER TABLE public.attorney_entry_reviews ENABLE ROW LEVEL SECURITY;