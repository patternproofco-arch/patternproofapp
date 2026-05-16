
CREATE TYPE legal_document_type AS ENUM ('tro','fro','police_report','911_log','cps_report','custody_order','court_order','hearing_transcript','other');

CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type legal_document_type NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  case_number text,
  court_name text,
  judge_name text,
  effective_date date,
  expiration_date date,
  protected_party text,
  restrained_party text,
  issuing_officer text,
  incident_date date,
  key_terms text,
  ai_extracted boolean NOT NULL DEFAULT false,
  ai_extraction_confirmed boolean NOT NULL DEFAULT false,
  linked_incident_ids uuid[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own legal_documents" ON public.legal_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
