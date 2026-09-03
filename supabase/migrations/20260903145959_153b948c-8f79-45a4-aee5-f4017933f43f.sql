CREATE TABLE IF NOT EXISTS public.incident_evidence_links (
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.evidence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'survivor',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS incident_evidence_links_user_idx
  ON public.incident_evidence_links(user_id);
CREATE INDEX IF NOT EXISTS incident_evidence_links_evidence_idx
  ON public.incident_evidence_links(evidence_id);

ALTER TABLE public.incident_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_evidence_links_select_own
  ON public.incident_evidence_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY incident_evidence_links_insert_own
  ON public.incident_evidence_links FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_id AND i.user_id = auth.uid() AND i.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.evidence e
      WHERE e.id = evidence_id AND e.user_id = auth.uid() AND e.deleted_at IS NULL
    )
  );

CREATE POLICY incident_evidence_links_delete_own
  ON public.incident_evidence_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.incident_evidence_links TO authenticated;
GRANT ALL ON public.incident_evidence_links TO service_role;

INSERT INTO public.incident_evidence_links (incident_id, evidence_id, user_id, source)
SELECT linked_incident_id, id, user_id, 'legacy'
FROM public.evidence
WHERE linked_incident_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (incident_id, evidence_id) DO NOTHING;