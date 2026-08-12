CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  court_ready_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  amount_paid numeric,
  stripe_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlement"
  ON public.entitlements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_entitlements_user_id ON public.entitlements(user_id);

CREATE TRIGGER entitlements_touch_updated_at
  BEFORE UPDATE ON public.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();