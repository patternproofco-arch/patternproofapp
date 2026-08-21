-- Queryable record of Terms of Service acceptance, tied to the user. Distinct
-- from the agreed_terms_at timestamp already written into auth.users user
-- metadata by onboarding: metadata isn't joinable in SQL, which is what a
-- weekly report needs in order to check whether a referred signup ever
-- accepted terms.
CREATE TABLE public.user_terms_acceptance (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_terms_acceptance TO authenticated;
GRANT ALL ON public.user_terms_acceptance TO service_role;
ALTER TABLE public.user_terms_acceptance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own terms acceptance read" ON public.user_terms_acceptance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own terms acceptance insert" ON public.user_terms_acceptance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_user_terms_acceptance_accepted_at ON public.user_terms_acceptance (terms_accepted_at);
