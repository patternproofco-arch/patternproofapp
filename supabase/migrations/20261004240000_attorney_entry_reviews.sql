-- Attorney review queue: where each shared entry or file stands for ONE attorney
-- (New, Needs clarification, Reviewed), the attorney's private note, and the focused
-- question they asked about it.
--
-- Separate from the survivor's records on purpose: nothing here is ever written into an
-- entry, shown as the survivor's words, or included in an export of her statements.
-- Per attorney (not per firm): one person's triage and notes are not another's.
-- Opaque item keys only; the entry text is never copied here.
-- Access: server functions only (service role) after the attorney-access checks.
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.attorney_entry_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'needs_clarification', 'reviewed')),
  -- The entry's change marker when it was marked reviewed. If the entry changes, it returns to New.
  reviewed_marker text,
  -- Private to this attorney. Never exported, never shown to the survivor.
  attorney_note text NOT NULL DEFAULT '',
  question_request_id uuid REFERENCES public.attorney_document_requests(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, user_id, item_key)
);

CREATE INDEX IF NOT EXISTS attorney_entry_reviews_link_idx
  ON public.attorney_entry_reviews (link_id, user_id);

ALTER TABLE public.attorney_entry_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attorney_entry_reviews FROM anon, authenticated;
