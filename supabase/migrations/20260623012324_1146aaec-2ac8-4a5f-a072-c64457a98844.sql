CREATE TABLE public.attorney_evidence_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed','useful','needs_context','duplicate','exclude','privileged','exhibit_candidate')),
  exhibit_label text,
  notes text,
  linked_incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attorney_user_id, evidence_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_evidence_reviews TO authenticated;
GRANT ALL ON public.attorney_evidence_reviews TO service_role;

ALTER TABLE public.attorney_evidence_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage their own evidence reviews"
ON public.attorney_evidence_reviews
FOR ALL
TO authenticated
USING (auth.uid() = attorney_user_id AND public.has_attorney_access(auth.uid(), client_user_id))
WITH CHECK (auth.uid() = attorney_user_id AND public.has_attorney_access(auth.uid(), client_user_id));

CREATE TRIGGER touch_attorney_evidence_reviews_updated_at
BEFORE UPDATE ON public.attorney_evidence_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_attorney_evidence_reviews_attorney_client ON public.attorney_evidence_reviews(attorney_user_id, client_user_id);
CREATE INDEX idx_attorney_evidence_reviews_evidence ON public.attorney_evidence_reviews(evidence_id);