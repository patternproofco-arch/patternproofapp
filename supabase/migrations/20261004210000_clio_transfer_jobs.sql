-- Clio transfer jobs: one document per exhibit, an index, optional ZIP, with
-- per-file status so a partial failure can be resumed without sending anything twice.
--
-- Stores names, statuses, Clio document ids and file fingerprints. No file contents,
-- no survivor text. Access: server functions only (service role) after the
-- attorney-access checks. RLS on with no policies.
-- Grace: apply on muy only. Do not apply from CI/agent.

CREATE TABLE IF NOT EXISTS public.clio_transfer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.attorney_client_links(id) ON DELETE CASCADE,
  clio_matter_id text NOT NULL,
  matter_label text NOT NULL DEFAULT '',
  package_version integer NOT NULL,
  include_zip boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'completed_with_errors', 'stopped')),
  stop_reason text,
  -- Items that were NOT sent and why, so the record shows what was left out.
  excluded jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clio_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.clio_transfer_jobs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('exhibit', 'index', 'zip')),
  item_key text,
  exhibit_number integer,
  document_name text NOT NULL,
  marker text,
  source text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'confirmed', 'failed', 'skipped', 'needs_review')),
  attempts integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  clio_document_id text,
  -- Ids of documents Clio created but that never finished uploading.
  orphan_clio_document_ids text[] NOT NULL DEFAULT '{}',
  bytes integer,
  sha256 text,
  started_at timestamptz,
  confirmed_at timestamptz,
  UNIQUE (job_id, document_name),
  UNIQUE (job_id, seq)
);

CREATE INDEX IF NOT EXISTS clio_transfer_items_dedupe_idx
  ON public.clio_transfer_items (document_name, status);
CREATE INDEX IF NOT EXISTS clio_transfer_jobs_link_idx
  ON public.clio_transfer_jobs (link_id, created_at DESC);

ALTER TABLE public.clio_transfer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clio_transfer_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clio_transfer_jobs FROM anon, authenticated;
REVOKE ALL ON public.clio_transfer_items FROM anon, authenticated;
