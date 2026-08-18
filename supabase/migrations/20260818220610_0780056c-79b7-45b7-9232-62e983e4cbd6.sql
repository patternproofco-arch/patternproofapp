CREATE TABLE public.user_security_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  app_lock_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_security_settings TO authenticated;
GRANT ALL ON public.user_security_settings TO service_role;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security settings read" ON public.user_security_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own security settings insert" ON public.user_security_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own security settings update" ON public.user_security_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);