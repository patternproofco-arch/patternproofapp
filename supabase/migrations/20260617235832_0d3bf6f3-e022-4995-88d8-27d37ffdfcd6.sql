
CREATE TABLE IF NOT EXISTS public.court_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_name TEXT NOT NULL,
  hearing_type TEXT NOT NULL,
  hearing_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_dates TO authenticated;
GRANT ALL ON public.court_dates TO service_role;

ALTER TABLE public.court_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survivors manage their own court dates"
  ON public.court_dates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Linked attorneys can view client court dates"
  ON public.court_dates FOR SELECT
  TO authenticated
  USING (public.has_attorney_access(auth.uid(), user_id));

CREATE TRIGGER touch_court_dates_updated_at
  BEFORE UPDATE ON public.court_dates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS court_dates_user_hearing_idx
  ON public.court_dates (user_id, hearing_at);

CREATE TABLE IF NOT EXISTS public.attorney_missing_evidence_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_label TEXT NOT NULL,
  notes TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attorney_missing_evidence_checklist TO authenticated;
GRANT ALL ON public.attorney_missing_evidence_checklist TO service_role;

ALTER TABLE public.attorney_missing_evidence_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorneys manage their own checklist items"
  ON public.attorney_missing_evidence_checklist FOR ALL
  TO authenticated
  USING (auth.uid() = attorney_user_id)
  WITH CHECK (
    auth.uid() = attorney_user_id
    AND public.has_attorney_access(auth.uid(), client_user_id)
  );

CREATE POLICY "Clients can view their own checklist"
  ON public.attorney_missing_evidence_checklist FOR SELECT
  TO authenticated
  USING (auth.uid() = client_user_id);

CREATE TRIGGER touch_missing_evidence_updated_at
  BEFORE UPDATE ON public.attorney_missing_evidence_checklist
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS missing_evidence_attorney_client_idx
  ON public.attorney_missing_evidence_checklist (attorney_user_id, client_user_id);
