-- Real gap found by comparing committed types.ts against the live schema:
-- src/lib/clio-documents.server.ts (pushLatestPacketToClio) inserts/updates
-- this table when an attorney pushes a professional-review packet to Clio,
-- but the table was never created by any tracked migration.
CREATE TABLE public.clio_document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL,
  attorney_client_link_id uuid REFERENCES public.attorney_client_links(id) ON DELETE SET NULL,
  clio_matter_id text NOT NULL,
  document_name text NOT NULL,
  byte_size bigint,
  clio_document_id text,
  status text NOT NULL DEFAULT 'pending',
  error_code text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Written exclusively via supabaseAdmin (service role) from the server
-- function above; attorneys may read their own push history client-side.
GRANT SELECT ON public.clio_document_exports TO authenticated;
GRANT ALL ON public.clio_document_exports TO service_role;

ALTER TABLE public.clio_document_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys read their own clio document exports"
ON public.clio_document_exports FOR SELECT TO authenticated
USING (attorney_user_id = auth.uid());

CREATE INDEX clio_document_exports_attorney_idx ON public.clio_document_exports (attorney_user_id, created_at DESC);
CREATE INDEX clio_document_exports_link_idx ON public.clio_document_exports (attorney_client_link_id);
