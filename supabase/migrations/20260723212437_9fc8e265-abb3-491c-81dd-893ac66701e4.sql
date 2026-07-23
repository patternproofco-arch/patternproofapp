CREATE TABLE public.feedback_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audience text NOT NULL CHECK (audience IN ('survivor','attorney','org')),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  responses jsonb NOT NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback_submissions TO authenticated;
GRANT INSERT ON public.feedback_submissions TO anon;
GRANT ALL ON public.feedback_submissions TO service_role;

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own feedback (any audience).
CREATE POLICY "Authenticated users can submit their own feedback"
  ON public.feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Anonymous users can submit ONLY org feedback (no account required for DV orgs), and only unattributed.
CREATE POLICY "Anonymous users can submit org feedback"
  ON public.feedback_submissions
  FOR INSERT
  TO anon
  WITH CHECK (audience = 'org' AND user_id IS NULL);

CREATE INDEX idx_feedback_audience_created ON public.feedback_submissions (audience, created_at DESC);
