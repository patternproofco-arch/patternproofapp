ALTER TABLE public.clio_connections
  ADD COLUMN IF NOT EXISTS clio_region text NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS clio_user_name text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_refresh_at timestamptz;

CREATE TABLE IF NOT EXISTS public.clio_document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL,
  attorney_client_link_id uuid REFERENCES public.attorney_client_links(id) ON DELETE SET NULL,
  clio_matter_id text NOT NULL,
  clio_document_id text,
  document_name text NOT NULL,
  byte_size integer,
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

GRANT SELECT, INSERT ON public.clio_document_exports TO authenticated;
GRANT ALL ON public.clio_document_exports TO service_role;

ALTER TABLE public.clio_document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys read own clio document exports"
ON public.clio_document_exports FOR SELECT TO authenticated
USING (attorney_user_id = auth.uid());

CREATE POLICY "Attorneys insert own clio document exports"
ON public.clio_document_exports FOR INSERT TO authenticated
WITH CHECK (attorney_user_id = auth.uid());